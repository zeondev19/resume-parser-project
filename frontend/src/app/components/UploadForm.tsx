"use client";

import { useState } from "react";
import CandidateCard from "./CandidateCard";
import CandidateTable from "./CandidateTable";


export default function UploadForm() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  // Recruiter filter inputs
  const [skills, setSkills] = useState("");
  const [minExperience, setMinExperience] = useState<number | null>(null);
  const [education, setEducation] = useState("");
  const [keywords, setKeywords] = useState("");
  const [minScore, setMinScore] = useState<number | null>(null);
  const [mode, setMode] = useState<"strict" | "ranking">("strict");

  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCompare, setSelectedCompare] = useState<string[]>([]);
  const [jdData, setJdData] = useState<any | null>(null);

  // Upload resumes (multi)
  const handleUpload = async () => {
    if (!files || files.length === 0) return;
    setLoading(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("http://127.0.0.1:8000/upload/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      alert(`✅ Uploaded ${data.uploaded.length} resumes`);
    } catch (err) {
      console.error(err);
      alert("❌ Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadJD = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload_jd/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setJdData(data);

      // prefill recruiter form
      if (data.skills) setSkills(data.skills.join(", "));
      if (data.min_experience) setMinExperience(data.min_experience);
      if (data.education) setEducation(data.education);
      if (data.keywords) setKeywords(data.keywords.join(", "));
    } catch (err) {
      console.error(err);
      alert("❌ JD Upload failed");
    }
  };

  // Apply filter
  const handleFilter = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/filter/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: skills ? skills.split(",").map((s) => s.trim()) : [],
          min_experience: minExperience,
          education: education || null,
          keywords: keywords ? keywords.split(",").map((k) => k.trim()) : [],
          min_score: minScore,
          mode,
        }),
      });

      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err) {
      console.error(err);
      alert("❌ Filter failed");
    }
  };

  // Export shortlist CSV
  const handleExport = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/export/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: skills ? skills.split(",").map((s) => s.trim()) : [],
          min_experience: minExperience,
          education: education || null,
          keywords: keywords ? keywords.split(",").map((k) => k.trim()) : [],
          min_score: minScore,
          mode,
        }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ats_export.csv";
      a.click();
    } catch (err) {
      console.error(err);
      alert("❌ Export failed");
    }
  };

  // Compare selected candidates: call backend, store results in localStorage, navigate to /compare
  const handleCompare = async () => {
    if (selectedCompare.length < 2) {
      alert("❌ Select at least 2 candidates to compare");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/compare/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedCompare,
          skills: skills ? skills.split(",").map((s) => s.trim()) : [],
          min_experience: minExperience,
          education: education || null,
          keywords: keywords ? keywords.split(",").map((k) => k.trim()) : [],
          min_score: minScore,
          mode,
        }),
      });

      const data = await res.json();

      if (!data.candidates || data.candidates.length < 2) {
        alert("❌ Not enough candidates for comparison");
        return;
      }

      // save for compare page
      localStorage.setItem("compareData", JSON.stringify(data.candidates));
      window.location.href = "/compare";
    } catch (err) {
      console.error(err);
      alert("❌ Compare request failed");
    }
  };

  // Toggle select for compare
  const toggleSelect = (id: string) => {
    setSelectedCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // --- NEW: Clear all (backend memory + local UI) ---
  const handleClearAll = async () => {
    if (!confirm("Clear all uploaded resumes & parsed memory? This cannot be undone (in-memory).")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/clear", { method: "POST" });
      const data = await res.json();
      // clear UI caches
      setCandidates([]);
      setSelectedCompare([]);
      setFiles(null);
      setJdData(null);
      localStorage.removeItem("compareData");
      alert("✅ Cleared backend memory and local compare cache");
    } catch (err) {
      console.error(err);
      alert("❌ Clear failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-lg max-w-6xl w-full space-y-8">
      {/* Upload Section */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-gray-900">Upload Resume</h2>
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="mb-4 text-gray-800"
        />
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!files || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 transition text-white font-semibold rounded-lg disabled:bg-gray-400"
          >
            {loading ? "Uploading..." : "Upload"}
          </button>

          <button
            onClick={handleClearAll}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 transition text-white font-semibold rounded-lg disabled:bg-gray-400"
          >
            {loading ? "Clearing..." : "Clear All"}
          </button>
        </div>
      </div>

      {/* Upload Job Description */}
      <div className="p-4 border rounded-xl bg-gray-50">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Upload Job Description</h2>
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={(e) => e.target.files && handleUploadJD(e.target.files[0])}
          className="mb-2 text-gray-800"
        />
        {jdData && (
          <div className="text-sm text-gray-700">
            <p><strong>Detected Skills:</strong> {jdData.skills.join(", ")}</p>
            <p><strong>Min Experience:</strong> {jdData.min_experience || "-"}</p>
            <p><strong>Education:</strong> {jdData.education || "-"}</p>
            <p><strong>Keywords:</strong> {jdData.keywords.join(", ") || "-"}</p>
          </div>
        )}
      </div>

      {/* Recruiter Filters */}
      <div className="p-6 border rounded-xl bg-gray-50 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Recruiter Filters</h2>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Required skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            className="p-2 border rounded text-gray-800"
          />
          <input
            type="number"
            placeholder="Min years exp"
            value={minExperience ?? ""}
            onChange={(e) =>
              setMinExperience(e.target.value ? parseInt(e.target.value) : null)
            }
            className="p-2 border rounded text-gray-800"
          />
          <input
            type="text"
            placeholder="Education (e.g. Master)"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            className="p-2 border rounded text-gray-800"
          />
          <input
            type="text"
            placeholder="Keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="p-2 border rounded text-gray-800"
          />
          <input
            type="number"
            placeholder="Min score %"
            value={minScore ?? ""}
            onChange={(e) =>
              setMinScore(e.target.value ? parseInt(e.target.value) : null)
            }
            className="p-2 border rounded text-gray-800"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "strict" | "ranking")}
            className="p-2 border rounded text-gray-800"
          >
            <option value="strict">Strict ATS Mode</option>
            <option value="ranking">Ranking Mode</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleFilter}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 transition text-white font-semibold rounded-lg"
          >
            Apply Filter
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 transition text-white font-semibold rounded-lg"
          >
            Export CSV
          </button>
          <button
            onClick={handleCompare}
            disabled={selectedCompare.length < 2}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 transition text-white font-semibold rounded-lg disabled:bg-gray-400"
          >
            Compare ({selectedCompare.length})
          </button>
        </div>
      </div>

      {/* Candidates Result */}
      {candidates.length > 0 && (
        <CandidateTable
          candidates={candidates}
          selected={selectedCompare}
          toggleSelect={toggleSelect}
        />
      )}


    </div>
  );
}
