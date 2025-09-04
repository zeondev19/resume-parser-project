# main.py
# ATS-like resume backend with multi-resume upload, filter (strict/ranking), CSV export, and compare endpoint.
import re
import io
import csv
import uuid
import os
import json
import pdfplumber
import spacy
from datetime import datetime
from io import BytesIO
from typing import List, Optional, Dict, Any, Union
from fastapi import FastAPI, UploadFile, File, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI(title="ATS-like Resume Filter (Multi-upload)")

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# load spacy model once
nlp = spacy.load("en_core_web_sm")

# canonical skills list (expand as needed)
SKILLS = [
    "Python", "JavaScript", "TypeScript", "React", "Node.js",
    "Django", "FastAPI", "SQL", "NoSQL", "AWS", "Docker", "Kubernetes",
    "Machine Learning", "Data Analysis", "Figma", "Adobe Illustrator",
    "UI/UX", "UI Design", "Photoshop", "HTML", "CSS", "Wireframe", "Prototype", "Git"
]

# in-memory store for parsed resumes
# key: candidate_id (str uuid), value: parsed resume dict
parsed_resumes: Dict[str, Dict[str, Any]] = {}

# ---------- helpers for experience parsing & education detection (same robust functions) ----------
MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

DEGREE_LEVELS = {
    "highschool": ["high school", "smk", "sma"],
    "diploma": ["diploma", "associate"],
    "bachelor": ["bachelor", "sarjana", "s1", "b.sc", "bsc", "bs"],
    "master": ["master", "msc", "m.sc", "s2", "magister", "ms"],
    "phd": ["phd", "doctorate", "s3", "dr."]
}


def parse_month_year(s: str) -> Optional[datetime]:
    if not s or not s.strip():
        return None
    s = s.strip()
    m = re.match(r"([A-Za-z]{3,9})\s+(\d{4})", s)
    if m:
        mon, yr = m.groups()
        mon_key = mon[:3].lower()
        month = MONTH_MAP.get(mon_key) or MONTH_MAP.get(mon.lower())
        try:
            return datetime(int(yr), month or 1, 1)
        except Exception:
            return None
    m2 = re.match(r"(\d{4})", s)
    if m2:
        yr = int(m2.group(1))
        try:
            return datetime(yr, 1, 1)
        except:
            return None
    return None


def diff_years(start: datetime, end: datetime) -> float:
    days = (end - start).days
    return max(0.0, days / 365.25)


def merge_ranges(ranges: List[tuple]) -> List[tuple]:
    if not ranges:
        return []
    ranges_sorted = sorted(ranges, key=lambda x: x[0])
    merged = [ranges_sorted[0]]
    for cur_s, cur_e in ranges_sorted[1:]:
        prev_s, prev_e = merged[-1]
        if cur_s <= prev_e:
            merged[-1] = (prev_s, max(prev_e, cur_e))
        else:
            merged.append((cur_s, cur_e))
    return merged


def estimate_experience_years(text: str) -> float:
    now = datetime.now()
    ranges: List[tuple] = []

    # Pattern: "Feb 2021 - Mar 2023" or "February 2021 – Present"
    pattern_month_range = re.compile(
        r"([A-Za-z]{3,9}\s+\d{4})\s*[-–—]\s*(Present|Now|(?:[A-Za-z]{3,9}\s+\d{4}))",
        flags=re.IGNORECASE,
    )
    for m in pattern_month_range.finditer(text):
        start_raw, end_raw = m.groups()
        s = parse_month_year(start_raw)
        if end_raw.lower() in ("present", "now"):
            e = now
        else:
            e = parse_month_year(end_raw)
        if s and e and e >= s:
            ranges.append((s, e))

    # Pattern: "2020 - 2022" or "2018 - Present"
    pattern_year_range = re.compile(r"(\d{4})\s*[-–—]\s*(Present|Now|\d{4})", flags=re.IGNORECASE)
    for m in pattern_year_range.finditer(text):
        sy, ey_raw = m.groups()
        try:
            s = datetime(int(sy), 1, 1)
        except:
            continue
        if ey_raw.lower() in ("present", "now"):
            e = now
        else:
            try:
                e = datetime(int(ey_raw), 12, 31)
            except:
                continue
        if e >= s:
            ranges.append((s, e))

    if ranges:
        merged = merge_ranges(ranges)
        total_years = sum(diff_years(s, e) for s, e in merged)
        return round(min(total_years, 50.0), 2)

    # fallback: count "experience" sentences as proxy
    doc = nlp(text)
    experience_sentences = [sent for sent in doc.sents if "experience" in sent.text.lower()]
    if experience_sentences:
        return float(min(len(experience_sentences), 40))

    # final fallback: year diff between min and max year found in doc
    years_found = [int(y) for y in re.findall(r"\b(19|20)\d{2}\b", text)]
    if years_found and len(years_found) >= 2:
        try:
            return float(min(max(years_found) - min(years_found), 50))
        except:
            pass

    return 0.0


def detect_degree_level(edu_snippets: List[str]) -> Optional[str]:
    text = " ".join(edu_snippets).lower()
    for level, keywords in DEGREE_LEVELS.items():
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", text):
                return level
    return None


# ---------- parsing single PDF to structured data ----------
def parse_pdf_file(file: UploadFile) -> Dict[str, Any]:
    # Return structured parsed resume (not storing original bytes)
    try:
        with pdfplumber.open(file.file) as pdf:
            text = ""
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
    except Exception as e:
        # If pdfplumber fails, raise
        raise HTTPException(status_code=400, detail=f"Error reading PDF: {e}")

    text = text.strip()
    emails = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    phones = re.findall(r"\+?\d[\d\s().-]{7,}\d", text)

    # detect canonical skills
    low_text = text.lower()
    detected_skills = [s for s in SKILLS if s.lower() in low_text]

    # education snippets
    doc = nlp(text)
    education_snips = [sent.text.strip() for sent in doc.sents if re.search(
        r"\b(university|bachelor|master|phd|degree|diploma|s1|s2|s3|sarjana|magister)\b",
        sent.text, flags=re.I
    )]

    years_est = estimate_experience_years(text)

    parsed = {
        "filename": file.filename,
        "email": emails,
        "phone": phones,
        "skills_detected": detected_skills,
        "education": education_snips,
        "total_experience_years": years_est,
        "full_text": text,
        "uploaded_at": datetime.utcnow().isoformat(),
    }
    return parsed


# -------------------- API models --------------------
class FilterRequest(BaseModel):
    skills: List[str] = []
    min_experience: Optional[float] = None
    education: Optional[str] = None
    keywords: List[str] = []
    min_score: Optional[float] = 0.0
    mode: str = "strict"  # "strict" or "ranking"

class CompareRequest(FilterRequest):
    ids: List[str]

app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")

# ---------- Upload multiple resumes ----------
@app.post("/upload/")
async def upload_resumes(files: List[UploadFile] = File(...)):
    created = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            continue

        # 🔹 Baca bytes sekali
        content = await f.read()

        # 🔹 Simpan ke disk
        candidate_id = str(uuid.uuid4())
        save_name = f"{candidate_id}_{f.filename}"
        save_path = os.path.join(UPLOAD_DIR, save_name)
        with open(save_path, "wb") as buffer:
            buffer.write(content)

        # 🔹 Parse pakai BytesIO (hindari pointer kosong)
        parsed = parse_pdf_file(
            UploadFile(filename=f.filename, file=BytesIO(content))
        )

        parsed_resumes[candidate_id] = parsed
        parsed_resumes[candidate_id]["id"] = candidate_id
        parsed_resumes[candidate_id]["file_url"] = f"http://127.0.0.1:8000/files/{save_name}"

        created.append({
            "id": candidate_id,
            "filename": parsed["filename"],
            "file_url": parsed_resumes[candidate_id]["file_url"],
            "email": parsed.get("email", []),
            "phone": parsed.get("phone", []),
            "skills_detected": parsed.get("skills_detected", []),
            "total_experience_years": parsed.get("total_experience_years", 0),
        })

    if not created:
        raise HTTPException(status_code=400, detail="No valid PDF files uploaded.")
    return {"uploaded": created, "total_stored": len(parsed_resumes)}


def apply_filters_and_scoring(req: FilterRequest, candidate_ids: Optional[List[str]] = None):
    """
    Core filter/scoring logic.
    If candidate_ids is provided → only process those candidates.
    """
    if not parsed_resumes:
        return []

    candidates_out = []
    ids_to_process = candidate_ids or list(parsed_resumes.keys())

    for cid in ids_to_process:
        if cid not in parsed_resumes:
            continue
        r = parsed_resumes[cid]
        text_low = r.get("full_text", "").lower()
        detected_low = [s.lower() for s in r.get("skills_detected", [])]

        # --- Skills
        req_skills = [s.strip().lower() for s in req.skills if s and s.strip()]
        matched_skills = [s for s in req_skills if (s in text_low or s in detected_low)]
        missing_skills = [s for s in req_skills if s not in matched_skills]
        skill_percent = (len(matched_skills) / len(req_skills) * 100.0) if req_skills else 100.0

        # --- Experience
        years = float(r.get("total_experience_years") or 0.0)
        exp_percent = 100.0 if not req.min_experience else round(min(100.0, (years / req.min_experience) * 100.0), 2)

        # --- Education
        req_edu = (req.education or "").strip().lower()
        found_degree = detect_degree_level(r.get("education", []))
        edu_percent, edu_reject = 100.0, False
        if req_edu:
            if not found_degree or \
               (["highschool", "diploma", "bachelor", "master", "phd"].index(found_degree)
                < ["highschool", "diploma", "bachelor", "master", "phd"].index(req_edu)
                if req_edu in ["highschool","diploma","bachelor","master","phd"] else -1):
                edu_percent, edu_reject = 0.0, True

        # --- Keywords
        req_keywords = [k.strip().lower() for k in req.keywords if k and k.strip()]
        matched_keywords = [k for k in req_keywords if k in text_low]
        missing_keywords = [k for k in req_keywords if k not in matched_keywords]
        keyword_percent = (len(matched_keywords) / len(req_keywords) * 100.0) if req_keywords else 100.0

        # --- Reject reasons
        reject_reasons: List[str] = []
        if missing_skills:
            reject_reasons.append("Missing required skills: " + ", ".join(missing_skills))
        if req.min_experience is not None and years < float(req.min_experience):
            reject_reasons.append(f"Only {years} years experience (requires {req.min_experience})")
        if edu_reject:
            reject_reasons.append(f"Candidate education level '{found_degree or 'not found'}' does not meet requirement '{req_edu}'")
        if missing_keywords:
            reject_reasons.append("Missing required keywords: " + ", ".join(missing_keywords))

        # --- Weighted score
        score = (
            (skill_percent * 0.55) +
            (exp_percent * 0.25) +
            (edu_percent * 0.10) +
            (keyword_percent * 0.10)
        )

        passed = False
        if req.mode == "strict":
            passed = (len(reject_reasons) == 0) and (score >= float(req.min_score or 0.0))
        else:
            passed = score >= float(req.min_score or 0.0)

        candidate_result = {
            "id": cid,
            "filename": r.get("filename"),
            "email": r.get("email", []),
            "phone": r.get("phone", []),
            "skills_detected": r.get("skills_detected", []),
            "skills_required": req.skills,
            "skills_matched": matched_skills,
            "skills_missing": missing_skills,
            "total_experience_years": years,
            "education_snippets": r.get("education", []),
            "education_required": req.education,
            "education_found_level": found_degree,
            "keywords_required": req.keywords,
            "keywords_matched": matched_keywords,
            "keywords_missing": missing_keywords,
            "score": round(score, 2),
            "passed": passed,
            "reject_reasons": reject_reasons,
            "mode_used": req.mode,
            "weights": {
                "skills": round(skill_percent, 2),
                "experience": round(exp_percent, 2),
                "education": round(edu_percent, 2),
                "keywords": round(keyword_percent, 2),
            }
        }

        candidates_out.append(candidate_result)

    candidates_out.sort(key=lambda x: x["score"], reverse=True)
    return candidates_out



# ---------- Filter all stored resumes ----------
@app.post("/filter/")
async def filter_all(req: FilterRequest = Body(...)):
    if not parsed_resumes:
        return {"candidates": [], "message": "No resumes uploaded yet."}
    candidates_out = apply_filters_and_scoring(req)
    return {"candidates": candidates_out, "total": len(candidates_out)}



# ---------- Export shortlist as CSV ----------
@app.post("/export/")
async def export_csv(req: FilterRequest = Body(...)):
    """
    Run the same filter but return CSV of results (useful for recruiter export)
    """
    resp = await filter_all(req)  # reuse filter logic
    candidates = resp.get("candidates", [])

    # create CSV in-memory
    output = io.StringIO()
    writer = csv.writer(output)
    # header
    writer.writerow([
        "id", "filename", "email", "phone", "score", "passed",
        "skills_required", "skills_matched", "skills_missing",
        "experience_years", "education_found_level", "keywords_required", "keywords_matched",
        "reject_reasons"
    ])
    for c in candidates:
        writer.writerow([
            c.get("id"),
            c.get("filename"),
            ";".join(c.get("email", [])),
            ";".join(c.get("phone", [])),
            c.get("score"),
            c.get("passed"),
            ";".join(c.get("skills_required", [])) if c.get("skills_required") else "",
            ";".join(c.get("skills_matched", [])) if c.get("skills_matched") else "",
            ";".join(c.get("skills_missing", [])) if c.get("skills_missing") else "",
            c.get("total_experience_years"),
            c.get("education_found_level"),
            ";".join(c.get("keywords_required", [])) if c.get("keywords_required") else "",
            ";".join(c.get("keywords_matched", [])) if c.get("keywords_matched") else "",
            ";".join(c.get("reject_reasons", [])) if c.get("reject_reasons") else ""
        ])

    output.seek(0)
    filename = f"ats_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ---------- Upload JD Description ----------
@app.post("/upload_jd/")
async def upload_jd(file: UploadFile = File(...)):
    """
    Upload a Job Description (JD) file (PDF or TXT).
    Extract required skills, experience, education, and keywords
    so recruiter filter form can be pre-filled automatically.
    """
    text = ""

    # baca PDF atau TXT
    try:
        if file.filename.lower().endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(file.file) as pdf:
                for page in pdf.pages:
                    text += (page.extract_text() or "") + "\n"
        elif file.filename.lower().endswith(".txt"):
            text = (await file.read()).decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading JD: {e}")

    text_low = text.lower()

    # --- Extract skills
    detected_skills = [s for s in SKILLS if s.lower() in text_low]

    # --- Extract min years exp (regex cari angka sebelum 'year(s)')
    exp_match = re.search(r"(\d+)\s*\+?\s*(?:years?|yrs?)", text_low)
    min_experience = int(exp_match.group(1)) if exp_match else None

    # --- Extract education level
    edu_level = detect_degree_level([text])

    # --- Extract keywords (kata kunci unik non-skill, misal "leadership", "communication")
    common_keywords = ["leadership", "communication", "problem solving", "teamwork"]
    detected_keywords = [k for k in common_keywords if k in text_low]

    return {
        "filename": file.filename,
        "skills": detected_skills,
        "min_experience": min_experience,
        "education": edu_level,
        "keywords": detected_keywords,
        "raw_text": text[:1000]  # potong biar ringan, buat debug
    }



# ---------- Compare endpoint (side-by-side) ----------
@app.post("/compare/")
async def compare_candidates(payload: CompareRequest = Body(...)):
    """
    Accept candidate ids + same filter fields.
    Returns scored candidates side-by-side (same calc as /filter & /export).
    """
    if not payload.ids or len(payload.ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 candidates required for comparison")

    candidates_out = apply_filters_and_scoring(payload, candidate_ids=payload.ids)

    if len(candidates_out) < 2:
        raise HTTPException(status_code=400, detail="At least 2 valid candidates required")

    # 🔑 Inject file_url dari parsed_resumes
    for c in candidates_out:
        cid = c["id"]
        if cid in parsed_resumes:
            c["file_url"] = parsed_resumes[cid].get("file_url")

    return {"candidates": candidates_out}
    


# ---------- Clear memory (testing only) ----------
@app.post("/clear")
async def clear_all():
    parsed_resumes.clear()
    return {"ok": True, "total_stored": len(parsed_resumes)}
