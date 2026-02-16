"use client";

import { Search, Brain, Shield, Mail } from "lucide-react";

interface Phase {
  label: string;
  icon: React.ReactNode;
  status: "pending" | "active" | "done";
}

export default function PipelineProgress({ currentPhase }: { currentPhase: number }) {
  const phases: Phase[] = [
    {
      label: "Discovery",
      icon: <Search className="h-4 w-4" />,
      status: currentPhase > 1 ? "done" : currentPhase === 1 ? "active" : "pending",
    },
    {
      label: "Intelligence",
      icon: <Brain className="h-4 w-4" />,
      status: currentPhase > 2 ? "done" : currentPhase === 2 ? "active" : "pending",
    },
    {
      label: "Verification",
      icon: <Shield className="h-4 w-4" />,
      status: currentPhase > 3 ? "done" : currentPhase === 3 ? "active" : "pending",
    },
    {
      label: "Enrichment",
      icon: <Mail className="h-4 w-4" />,
      status: currentPhase > 4 ? "done" : currentPhase === 4 ? "active" : "pending",
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {phases.map((phase, i) => (
        <div key={phase.label} className="flex items-center">
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              phase.status === "done"
                ? "bg-green-100 text-green-700"
                : phase.status === "active"
                  ? "bg-blue-100 text-blue-700 animate-pulse"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {phase.icon}
            {phase.label}
          </div>
          {i < phases.length - 1 && (
            <div
              className={`mx-1 h-px w-6 ${
                phase.status === "done" ? "bg-green-300" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
