# 📂 Resume Parser Project

ATS-like Resume Parser built with **FastAPI (backend)** + **Next.js (frontend)**.  
Project ini dibuat untuk membantu recruiter/HR menyeleksi kandidat secara lebih cepat dengan fitur **resume parsing, filtering, scoring, dan comparison view**.

---

## 🚀 Features

- **Upload multiple resumes (PDF)**
- **Parse resume** → skills, experience, education, keywords, contact info
- **Upload Job Description (JD)** → auto-extract requirements
- **Filter candidates** (strict/ranking mode)
- **Score & pass/reject decision**
- **Side-by-side comparison view** (highlight best candidate)
- **Export shortlist to CSV**
- **View CV** langsung dari frontend (PDF modal / open file)

---

## 📂 Project Structure
```bash
resume-parser-project/
├─ backend/ # FastAPI backend
│ ├─ main.py # API utama
│ ├─ requirements.txt # dependensi Python
│ ├─ uploads/ # tempat penyimpanan file CV (gitignored)
│ └─ ...
├─ frontend/ # Next.js frontend
│ ├─ src/app/ # App router
│ ├─ package.json
│ └─ ...
├─ .gitignore
├─ README.md
```
---

## ⚙️ Requirements

- **Python** 3.10+
- **Node.js** 18+
- **Git** (untuk version control)

---

## 🔧 Backend Setup (FastAPI)

Masuk ke folder backend:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000

API berjalan di:
👉 http://127.0.0.1:8000


📑 API Routes

POST /upload/ → Upload resume(s)

POST /upload_jd/ → Upload job description

POST /filter/ → Filter & score candidates

POST /compare/ → Compare candidates

POST /export/ → Export shortlist CSV

POST /clear → Clear memory

GET /files/{filename} → Serve uploaded resumes (PDF)


🎨 Frontend Setup (Next.js)

Masuk ke folder frontend:

cd frontend
npm install
npm run dev

Frontend berjalan di:
👉 http://localhost:3000

🛠️ Development Notes

Semua resume PDF disimpan di backend/uploads/ dan bisa diakses melalui endpoint /files/{filename}.

uploads/ sudah gitignored, jadi file CV kandidat tidak ikut ke repository.

Gunakan fitur Compare untuk membandingkan kandidat (max 3 kandidat per layar, bisa geser dengan navigasi).

Fitur View CV di detail modal memungkinkan recruiter membuka PDF asli kandidat.
```

📜 License

zeondev19 © 2025
Developed with ❤️ to help recruiters streamline hiring.
