"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function CandidateCard({ candidate }: { candidate: any }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{candidate.filename}</h2>
      <p className="text-sm text-gray-600">
        <strong>Email:</strong> {candidate.email?.join(", ") || "-"}
      </p>
      <p className="text-sm text-gray-600">
        <strong>Phone:</strong> {candidate.phone?.join(", ") || "-"}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold mb-2">Experience</h3>
          <p>{candidate.total_experience_years} years</p>
        </div>
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold mb-2">Education</h3>
          <p>{candidate.education_found_level || "-"}</p>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold mb-2">Skills</h3>
        <p className="text-green-600">
          ✅ {candidate.skills_matched?.join(", ") || "-"}
        </p>
        <p className="text-red-600">
          ❌ {candidate.skills_missing?.join(", ") || "-"}
        </p>
      </div>

      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold mb-2">Keywords</h3>
        <p className="text-green-600">
          ✅ {candidate.keywords_matched?.join(", ") || "-"}
        </p>
        <p className="text-red-600">
          ❌ {candidate.keywords_missing?.join(", ") || "-"}
        </p>
      </div>

      <div className="p-4 border rounded-lg bg-gray-50 flex flex-col items-center">
        <h3 className="font-semibold mb-2">Score</h3>
        <Progress value={Math.round(candidate.score)} className="h-2 w-full mb-2" />
        <p>{candidate.score}%</p>
        <Badge className={candidate.passed ? "bg-green-600" : "bg-red-600"}>
          {candidate.passed ? "Passed" : "Rejected"}
        </Badge>
      </div>

      {candidate.reject_reasons?.length > 0 && (
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold mb-2">Reject Reasons</h3>
          <ul className="list-disc list-inside text-sm text-red-600">
            {candidate.reject_reasons.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔗 View CV button */}
      {candidate.file_url && (
        <div className="pt-4 text-center">
          <a
            href={candidate.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            View CV
          </a>
        </div>
      )}
    </div>
  );
}
