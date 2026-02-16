"use client";

import { useState, useCallback } from "react";
import { Play, Download, BarChart3, Target, Loader2, FileText, Bug, ChevronDown, Camera } from "lucide-react";
import { PipelineRunResult, VerifiedDoctor } from "../lib/types";
import { calculateProjections } from "../lib/campaign-projections";
import { doctorsToCSV, doctorsToPlainText, pipelineToDebugText, downloadFile } from "../lib/csv-export";
import PipelineProgress from "./PipelineProgress";
import CostDisplay from "./CostDisplay";
import TierBadge from "./TierBadge";
import DoctorProfile from "./DoctorProfile";
import Analytics from "./Analytics";
import CampaignProjectionsView from "./CampaignProjectionsView";
import ApiEffectiveness from "./ApiEffectiveness";

type Tab = "results" | "analytics" | "projections" | "effectiveness";

export default function Dashboard() {
  const [result, setResult] = useState<PipelineRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<VerifiedDoctor | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("results");
  const [maxQueries, setMaxQueries] = useState(3);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [exportOpen, setExportOpen] = useState(false);

  const runPipeline = useCallback(async () => {
    setRunning(true);
    setError(null);
    setCurrentPhase(1);
    setResult(null);
    setProgressMessage("Starting discovery...");

    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxQueries, stream: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Pipeline failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "phase") {
              setCurrentPhase(data.phase);
              setProgressMessage(data.label);
            } else if (data.type === "progress") {
              setCurrentPhase(data.phase);
              const pct = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
              setProgressMessage(
                data.doctor
                  ? `Phase ${data.phase}: ${data.processed}/${data.total} (${pct}%) — ${data.doctor}`
                  : `Phase ${data.phase}: ${data.processed}/${data.total} (${pct}%)`
              );
            } else if (data.type === "complete") {
              setResult(data.result);
              setCurrentPhase(5);
              setProgressMessage("Complete");
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (parseErr) {
            // Skip malformed SSE events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
      setCurrentPhase(0);
    } finally {
      setRunning(false);
    }
  }, [maxQueries]);

  function handleExportCSV() {
    if (!result) return;
    const csv = doctorsToCSV(result.doctors);
    downloadFile(csv, `derm-hunter-${new Date().toISOString().split("T")[0]}.csv`);
    setExportOpen(false);
  }

  function handleExportText() {
    if (!result) return;
    const text = doctorsToPlainText(result.doctors);
    downloadFile(text, `derm-hunter-${new Date().toISOString().split("T")[0]}.txt`, "text/plain");
    setExportOpen(false);
  }

  function handleExportDebug() {
    if (!result) return;
    const debug = pipelineToDebugText(result);
    downloadFile(debug, `derm-hunter-debug-${new Date().toISOString().split("T")[0]}.txt`, "text/plain");
    setExportOpen(false);
  }

  function handleCaptureSnapshot() {
    if (!result) return;
    const snapshot = {
      result,
      capturedAt: new Date().toISOString(),
      note: "Demo snapshot for cached demo mode",
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "demo-snapshot.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const isDev = process.env.NODE_ENV === "development";
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const filteredDoctors = result?.doctors.filter((d) =>
    tierFilter === "all" ? true : d.verification.tier === tierFilter
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Derm Hunter Engine</h1>
            <p className="text-xs text-gray-500">
              AI-powered dermatologist discovery for Future Clinic
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={maxQueries}
              onChange={(e) => setMaxQueries(Number(e.target.value))}
              disabled={running}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={1}>1 query (fast test)</option>
              <option value={3}>3 queries (balanced)</option>
              <option value={5}>5 queries (thorough)</option>
              <option value={10}>10 queries (full scan)</option>
            </select>
            <button
              onClick={runPipeline}
              disabled={running}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
              ) : (
                <><Play className="h-4 w-4" /> Run Pipeline</>
              )}
            </button>
            {isDev && result && (
              <button
                onClick={handleCaptureSnapshot}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                title="Save current results as demo snapshot"
              >
                <Camera className="h-3.5 w-3.5" /> Snapshot
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Demo Mode Banner */}
        {isDemo && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <strong>Demo Mode</strong> — Showing results from a real pipeline run. No API calls are being made.
          </div>
        )}

        {/* Progress */}
        {(running || currentPhase > 0) && (
          <div className="mb-6 space-y-2">
            <PipelineProgress currentPhase={currentPhase} />
            {progressMessage && (
              <p className="text-center text-xs text-gray-500">{progressMessage}</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Stats Bar */}
            <div className="mb-6 grid grid-cols-6 gap-3">
              <StatCard label="Discovered" value={result.stats.discovered} />
              <StatCard label="Passed Gate" value={result.stats.identified} />
              <StatCard label="Verified" value={result.stats.verified} />
              <StatCard label="With Email" value={result.stats.withEmail} />
              <StatCard label="With LinkedIn" value={result.stats.withLinkedIn} />
              <StatCard label="With Phone" value={result.stats.withPhone} />
            </div>

            {/* Gate Reasons (if any) */}
            {result.stats.gatedReasons && Object.keys(result.stats.gatedReasons).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(result.stats.gatedReasons).map(([reason, count]) => (
                  <span key={reason} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    {reason.replace(/_/g, " ")}: {count}
                  </span>
                ))}
              </div>
            )}

            {/* Cost Display */}
            <div className="mb-6">
              <CostDisplay costs={result.costs} />
            </div>

            {/* Tabs */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-1">
                {([
                  { key: "results" as Tab, label: "Results", icon: <Target className="h-4 w-4" /> },
                  { key: "analytics" as Tab, label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
                  { key: "effectiveness" as Tab, label: "API Sources", icon: <BarChart3 className="h-4 w-4" /> },
                  { key: "projections" as Tab, label: "Projections", icon: <BarChart3 className="h-4 w-4" /> },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                      activeTab === tab.key
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {activeTab === "results" && (
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    <option value="all">All Tiers</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="bronze">Bronze</option>
                  </select>
                )}

                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setExportOpen(!exportOpen)}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-3 w-3" /> Export <ChevronDown className="h-3 w-3" />
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      <button onClick={handleExportCSV} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                        <Download className="h-3 w-3" /> CSV (with sources)
                      </button>
                      <button onClick={handleExportText} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                        <FileText className="h-3 w-3" /> Plain Text
                      </button>
                      <button onClick={handleExportDebug} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                        <Bug className="h-3 w-3" /> AI Debug Log
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === "results" && (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3">Subscribers</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Sources</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredDoctors.map((doctor) => (
                      <tr key={doctor.channel.channelId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {doctor.channel.thumbnailUrl && (
                              <img
                                src={doctor.channel.thumbnailUrl}
                                alt=""
                                className="h-8 w-8 rounded-full"
                              />
                            )}
                            <div>
                              <div className="font-medium text-gray-900">
                                {doctor.identity.fullDisplay || doctor.channel.title}
                              </div>
                              <div className="text-xs text-gray-500">{doctor.channel.title}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {doctor.channel.subscriberCount >= 0
                            ? doctor.channel.subscriberCount.toLocaleString()
                            : "Hidden"}
                        </td>
                        <td className="px-4 py-3">
                          <TierBadge tier={doctor.verification.tier} />
                        </td>
                        <td className="px-4 py-3 text-gray-600">{doctor.verification.confidence}%</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {doctor.contact.email && <ContactDot color="blue" title={`Email (${doctor.contact.emailSource})`} />}
                            {doctor.contact.linkedinUrl && <ContactDot color="indigo" title={`LinkedIn (${doctor.contact.linkedinSource})`} />}
                            {doctor.contact.doximityUrl && <ContactDot color="purple" title={`Doximity (${doctor.contact.doximitySource})`} />}
                            {doctor.contact.phone && <ContactDot color="green" title={`Phone (${doctor.contact.phoneSource})`} />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {doctor.contact.allSourcesChecked.map((s) => (
                              <span key={s} className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                                {s.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedDoctor(doctor)}
                            className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredDoctors.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No doctors found matching the filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "analytics" && <Analytics result={result} />}

            {activeTab === "effectiveness" && result.sourceStats && (
              <ApiEffectiveness sourceStats={result.sourceStats} />
            )}

            {activeTab === "projections" && (
              <CampaignProjectionsView projections={calculateProjections(result.doctors)} />
            )}
          </>
        )}

        {/* Empty state */}
        {!result && !running && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="mb-4 h-12 w-12 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-700">Ready to Hunt</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Click &quot;Run Pipeline&quot; to discover dermatologist content creators on YouTube,
              verify their credentials, and find their contact information.
            </p>
          </div>
        )}
      </div>

      {/* Doctor Profile Slide-out */}
      {selectedDoctor && (
        <DoctorProfile doctor={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function ContactDot({ color, title }: { color: string; title: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500",
    indigo: "bg-indigo-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
  };

  return (
    <div
      className={`h-2.5 w-2.5 rounded-full ${colorMap[color] || "bg-gray-400"}`}
      title={title}
    />
  );
}
