"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CandidateCard from "./CandidateCard";

export default function CandidateTable({
  candidates,
  selected,
  toggleSelect,
}: {
  candidates: any[];
  selected: string[];
  toggleSelect: (id: string) => void;
}) {
  const [detail, setDetail] = useState<any | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Select</th>
            <th className="border p-2">Resume</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Experience</th>
            <th className="border p-2">Education</th>
            <th className="border p-2">Score</th>
            <th className="border p-2">Decision</th>
            <th className="border p-2">Detail</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="border p-2 text-center">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggleSelect(c.id)}
                />
              </td>
              <td className="border p-2">{c.filename}</td>
              <td className="border p-2">{c.email?.[0] || "-"}</td>
              <td className="border p-2">{c.total_experience_years} yrs</td>
              <td className="border p-2">{c.education_found_level || "-"}</td>
              <td className="border p-2">{c.score}%</td>
              <td className="border p-2">
                {c.passed ? (
                  <Badge className="bg-green-600">Passed</Badge>
                ) : (
                  <Badge className="bg-red-600">Rejected</Badge>
                )}
              </td>
              <td className="border p-2 text-center">
                <button
                  onClick={() => setDetail(c)}
                  className="text-blue-600 hover:underline"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for detail */}
<Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{detail?.filename || "Candidate Detail"}</DialogTitle>
    </DialogHeader>

    {detail && (
  <div className="space-y-4">
    {console.log("Candidate detail in modal:", detail)}

    {/* Candidate parsed details */}
    <CandidateCard candidate={detail} />

    {/* View CV button */}
    {detail.file_url ? (
      <div className="pt-4">
        <a
          href={detail.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          📄 View CV
        </a>
      </div>
    ) : (
      <p className="text-red-500">❌ CV file not found</p>
    )}
  </div>
)}

  </DialogContent>
</Dialog>

    </div>
  );
}
