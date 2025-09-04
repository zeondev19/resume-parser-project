"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function ComparePage() {
  const router = useRouter();

  const [candidates, setCandidates] = useState<any[]>([]);
  const [start, setStart] = useState(0);
  const pageSize = 3;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("compareData");
      if (saved) {
        setCandidates(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed parse compareData", e);
      setCandidates([]);
    }
  }, []);

  const topScore = useMemo(
    () => (candidates.length ? Math.max(...candidates.map((c) => Number(c.score) || 0)) : 0),
    [candidates]
  );

  const total = candidates.length;
  const end = Math.min(total, start + pageSize);
  const visible = candidates.slice(start, end);

  const prev = () => setStart((s) => Math.max(0, s - pageSize));
  const next = () => setStart((s) => Math.min(Math.max(0, total - pageSize), s + pageSize));

  // 🔴 Clear compare data
  const handleClearCompare = () => {
    if (!confirm("Clear this comparison and go back?")) return;
    localStorage.removeItem("compareData");
    setCandidates([]);
    router.push("/"); // redirect to UploadForm page
  };

  if (candidates.length < 2) {
    return <p className="p-6">❌ At least 2 candidates required for comparison</p>;
  }

  const fields = [
    { key: "filename", label: "Resume" },
    { key: "email", label: "Email" },
    { key: "total_experience_years", label: "Experience (Years)" },
    { key: "education_found_level", label: "Education" },
    { key: "skills_matched", label: "Matched Skills" },
    { key: "skills_missing", label: "Missing Skills" },
    { key: "keywords_matched", label: "Matched Keywords" },
    { key: "keywords_missing", label: "Missing Keywords" },
    { key: "score", label: "Score" },
    { key: "passed", label: "Decision" },
    { key: "reject_reasons", label: "Reject Reasons" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🆚 Candidate Comparison</h1>
        <button
          onClick={handleClearCompare}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Clear Compare
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse border border-gray-200 text-sm">
          <thead>
            <tr>
              <th className="border p-3 text-left bg-gray-100 sticky left-0 z-10 min-w-[200px]">
                Criteria
              </th>
              {visible.map((c, idx) => (
                <th
                  key={idx}
                  className="border p-3 text-left bg-gray-50 min-w-[300px] max-w-[300px]"
                >
                  {c.filename}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.key}>
                <td className="border p-3 font-semibold bg-gray-50 sticky left-0 z-10 min-w-[200px]">
                  {f.label}
                </td>
                {visible.map((c, idx) => {
                  const value = c[f.key];
                  if (Array.isArray(value)) {
                    return (
                      <td key={idx} className="border p-3 whitespace-pre-wrap">
                        {value.length > 0 ? value.join(", ") : "-"}
                      </td>
                    );
                  }
                  if (f.key === "filename") {
                    const fileLink = c.file_url || `/files/${c.id}_${c.filename}`;
                    return (
                      <td key={idx} className="border p-3">
                        <a
                          href={fileLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {c.filename}
                        </a>
                      </td>
                    );
                  }

                  if (f.key === "score") {
                    return (
                      <td
                        key={idx}
                        className={`border p-3 ${
                          Number(c.score) === topScore ? "bg-green-50" : ""
                        }`}
                      >
                        <Progress value={Math.round(value)} className="h-2 mb-1" />
                        {value ? `${value}%` : "-"}
                      </td>
                    );
                  }
                  if (f.key === "passed") {
                    return (
                      <td key={idx} className="border p-3">
                        {value ? (
                          <Badge className="bg-green-600">Passed</Badge>
                        ) : (
                          <Badge className="bg-red-600">Rejected</Badge>
                        )}
                      </td>
                    );
                  }
                  return <td key={idx} className="border p-3">{value || "-"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={prev}
          disabled={start === 0}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          ◀ Prev
        </button>
        <span className="text-sm text-gray-600">
          Showing {start + 1}–{end} of {total}
        </span>
        <button
          onClick={next}
          disabled={end >= total}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
