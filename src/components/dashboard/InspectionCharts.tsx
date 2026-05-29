"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { X } from "lucide-react";
import type { InspectionResult } from "@/types/inspection";
import type { SessionMetrics } from "@/types/inference";
import { formatSampleSequenceLabel } from "@/lib/inference-utils";
import { Panel } from "@/components/ui/Panel";

interface InspectionChartsProps {
  open: boolean;
  onClose: () => void;
  results: InspectionResult[];
  metrics: SessionMetrics;
  timelineLength: number;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

export function InspectionCharts({
  open,
  onClose,
  results,
  metrics,
  timelineLength,
}: InspectionChartsProps) {
  if (!open) return null;

  const realResults = results.filter((r) => !r.isDemoFallback);
  const scoreSeries = realResults.map((result, index) => ({
    label: formatSampleSequenceLabel(index + 1),
    score: result.anomalyScore ?? 0,
    threshold: result.scoreThreshold ?? metrics.scoreThreshold ?? 0,
    fileName: result.sampleName,
  }));

  const latencySeries = realResults.map((result, index) => ({
    label: formatSampleSequenceLabel(index + 1),
    latency: result.latencyMs ?? 0,
  }));

  const distribution = [
    { name: "Normal", value: metrics.normalCount, color: "#34d399" },
    { name: "Anomaly", value: metrics.anomalyCount, color: "#f87171" },
  ].filter((entry) => entry.value > 0);

  const topAnomalies = [...realResults]
    .filter((r) => r.isAnomaly)
    .sort((a, b) => (b.anomalyScore ?? 0) - (a.anomalyScore ?? 0))
    .slice(0, 5)
    .map((result, index) => ({
      label: result.sampleName.slice(0, 18),
      score: result.anomalyScore ?? 0,
      rank: index + 1,
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-lab-border bg-[#0d0e12] shadow-2xl">
        <div className="flex items-center justify-between border-b border-lab-border px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-lab-muted">
              SESSION METRICS
            </p>
            <p className="text-xs text-lab-text">
              Derived from {metrics.totalProcessed} real prediction
              {metrics.totalProcessed === 1 ? "" : "s"}
              {metrics.failedCount > 0 ? ` · ${metrics.failedCount} failed` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lab-border p-1.5 text-lab-muted hover:text-lab-text"
            aria-label="Close charts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {realResults.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-lab-muted">
            No prediction results yet. Run inspections to populate charts.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
            <Panel className="p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-lab-muted">
                Anomaly score vs threshold
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreSeries}>
                    <CartesianGrid stroke="#2a2d36" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: "#8b8fa3", fontSize: 9 }} />
                    <YAxis tick={{ fill: "#8b8fa3", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{ background: "#12141a", border: "1px solid #2a2d36" }}
                      formatter={(value: number) => [formatScore(value), "score"]}
                    />
                    <Line type="monotone" dataKey="score" stroke="#60a5fa" strokeWidth={2} dot />
                    <Line
                      type="monotone"
                      dataKey="threshold"
                      stroke="#f87171"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-lab-muted">
                Normal vs Anomaly
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                      {distribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#12141a", border: "1px solid #2a2d36" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-lab-muted">
                Latency per prediction (ms)
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencySeries}>
                    <CartesianGrid stroke="#2a2d36" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: "#8b8fa3", fontSize: 9 }} />
                    <YAxis tick={{ fill: "#8b8fa3", fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: "#12141a", border: "1px solid #2a2d36" }} />
                    <Bar dataKey="latency" fill="#a78bfa" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-lab-muted">
                Top anomalies by score
              </p>
              {topAnomalies.length === 0 ? (
                <p className="py-8 text-center text-xs text-lab-muted">No anomalies detected yet.</p>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topAnomalies} layout="vertical">
                      <CartesianGrid stroke="#2a2d36" strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fill: "#8b8fa3", fontSize: 9 }} />
                      <YAxis type="category" dataKey="label" width={90} tick={{ fill: "#8b8fa3", fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{ background: "#12141a", border: "1px solid #2a2d36" }}
                        formatter={(value: number) => [formatScore(value), "anomaly_score"]}
                      />
                      <Bar dataKey="score" fill="#f87171" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel className="p-3 md:col-span-2">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-lab-muted">Session summary</p>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div>
                  <p className="text-lab-muted">Processed</p>
                  <p className="font-semibold">{metrics.totalProcessed}</p>
                </div>
                <div>
                  <p className="text-lab-muted">Anomaly rate</p>
                  <p className="font-semibold">{(metrics.anomalyRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-lab-muted">Avg anomaly score</p>
                  <p className="font-mono font-semibold">
                    {metrics.avgAnomalyScore != null ? formatScore(metrics.avgAnomalyScore) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-lab-muted">Avg latency</p>
                  <p className="font-semibold">
                    {metrics.avgLatencyMs != null ? `${metrics.avgLatencyMs.toFixed(0)} ms` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-lab-muted">Score threshold</p>
                  <p className="font-mono font-semibold">
                    {metrics.scoreThreshold != null ? formatScore(metrics.scoreThreshold) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-lab-muted">Avg error mean</p>
                  <p className="font-semibold">
                    {metrics.avgErrorMean != null ? metrics.avgErrorMean.toFixed(5) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-lab-muted">Timeline entries</p>
                  <p className="font-semibold">{timelineLength}</p>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
