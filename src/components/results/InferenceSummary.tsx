"use client";

import { BarChart3, RotateCcw } from "lucide-react";
import { isApiCategory } from "@/config/api-categories";
import { DAE_BBOX_METHOD, DAE_LOCALIZATION_METHOD, DAE_MODEL_TYPE_LABEL } from "@/config/mvtec-dae-artifacts";
import {
  BBOX_DISCLAIMER_SHORT,
  BOX_NOTE_SHORT,
  shouldRenderPredictBoxes,
  shortLocalizationMethod,
} from "@/lib/inspection-display";
import { SummaryMetric } from "@/components/results/SummaryMetric";
import { StatusGauge } from "@/components/results/StatusGauge";
import { TechnicalDetailsSection } from "@/components/results/TechnicalDetailsSection";
import { SidebarTimelineCard } from "@/components/timeline/SidebarTimelineCard";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { resultToDashboardMetrics } from "@/services/inspectionService";
import type { DashboardSeverity } from "@/types/inference";
import { Panel } from "@/components/ui/Panel";
import { useInspectionStore, useSelectedSample } from "@/store/inspection-store";
import { cn } from "@/lib/utils";

interface InferenceSummaryProps {
  onReprocessSample?: (sampleId: string) => void;
  onStartPending?: () => void;
  onReprocessAll?: () => void;
  onStopLine?: () => void;
}

function SummaryShell({ children }: { children: React.ReactNode }) {
  return (
    <aside className="inspection-sidebar lab-sidebar-right shrink-0">
      <p className="inspection-sidebar-title">Inspection summary</p>
      {children}
    </aside>
  );
}

export function InferenceSummary({
  onReprocessSample,
}: InferenceSummaryProps) {
  const currentResult = useInspectionStore((s) => s.currentResult);
  const apiHealth = useInspectionStore((s) => s.apiHealth);
  const isInspecting = useInspectionStore((s) => s.isInspecting);
  const sessionMetrics = useInspectionStore((s) => s.sessionMetrics);
  const demoFallbackEnvEnabled = useInspectionStore((s) => s.demoFallbackEnvEnabled);
  const selectedSample = useSelectedSample();
  const metrics = resultToDashboardMetrics(currentResult);

  if (isInspecting && !metrics) {
    return (
      <SummaryShell>
        <div className="inspection-sidebar-scroll">
          <div className="summary-content">
            <p className="text-[10px] text-lab-muted">Analyzing image with autoencoder…</p>
          </div>
          <SidebarTimelineCard />
        </div>
      </SummaryShell>
    );
  }

  if (!metrics) {
    return (
      <SummaryShell>
        <div className="inspection-sidebar-scroll">
          <div className="summary-content">
            <p className="text-[10px] text-lab-muted">No images processed yet.</p>
            <p className="text-[9px] leading-snug text-lab-muted">
              Select a sample and run POST /predict.
            </p>
          </div>
          <SidebarTimelineCard />
        </div>
      </SummaryShell>
    );
  }

  if (metrics.isUnsupported) {
    return (
      <SummaryShell>
        <div className="inspection-sidebar-scroll">
          <div className="summary-content">
            <p className="text-[10px] text-lab-muted">Unsupported category for this model.</p>
          </div>
          <SidebarTimelineCard />
        </div>
      </SummaryShell>
    );
  }

  const bboxMethod = currentResult?.bboxMethod ?? DAE_BBOX_METHOD;
  const boxesCount = currentResult?.boxes.length ?? 0;
  const visibleBoxes = shouldRenderPredictBoxes(currentResult) ? boxesCount : 0;
  const localizationMethod = shortLocalizationMethod(DAE_LOCALIZATION_METHOD);
  const isAnomaly = metrics.verdictKind === "anomaly";

  return (
    <SummaryShell>
      <div className="inspection-sidebar-scroll">
        {(demoFallbackEnvEnabled || metrics.isDemoFallback) && (
          <div className="mb-1 space-y-0.5">
            {demoFallbackEnvEnabled && (
              <p className="text-[9px] uppercase tracking-wide text-lab-anomaly">Demo fallback active</p>
            )}
            {metrics.isDemoFallback && (
              <p className="text-[9px] uppercase tracking-wide text-lab-anomaly">Demo fallback result</p>
            )}
          </div>
        )}

        <div className="summary-content">
          {selectedSample && onReprocessSample && (
            <button
              type="button"
              onClick={() => onReprocessSample(selectedSample.id)}
              disabled={isInspecting}
              className="summary-compact-btn w-full disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" />
              Re-run selected sample
            </button>
          )}

          <Panel className="summary-card">
            <p className="summary-card-title">Scores</p>
            <div className="summary-grid">
              <SummaryMetric label="Category" value={metrics.apiCategory || "—"} />
              <SummaryMetric
                label="Score"
                value={<AnimatedNumber value={metrics.anomalyScore} decimals={3} />}
                tone={isAnomaly ? "anomaly" : "ok"}
              />
              <SummaryMetric
                label="Threshold"
                value={<AnimatedNumber value={metrics.scoreThreshold} decimals={3} />}
              />
              <SummaryMetric
                label="Z-map max"
                value={<AnimatedNumber value={metrics.zMapMax} decimals={3} />}
                tone={isAnomaly ? "anomaly" : "default"}
              />
              <SummaryMetric
                label="Latency"
                value={
                  <AnimatedNumber
                    value={metrics.latencyMs}
                    duration={400}
                    decimals={0}
                    suffix=" ms"
                  />
                }
              />
              <SummaryMetric
                label="Error mean"
                value={<AnimatedNumber value={metrics.errorMean} decimals={5} />}
              />
            </div>
          </Panel>

          <Panel className="summary-card summary-card--status">
            <p className="summary-card-title">Status</p>
            <StatusGauge
              status={metrics.verdict}
              anomalyScore={metrics.anomalyScore}
              threshold={metrics.scoreThreshold}
              ratio={metrics.scoreRatio}
              severity={metrics.severity as DashboardSeverity}
              isAnomaly={isAnomaly}
            />
          </Panel>

          <SidebarTimelineCard />

          <Panel className="summary-card">
            <p className="summary-card-title">Model</p>
            <SummaryMetric label="Type" value={DAE_MODEL_TYPE_LABEL} />
          </Panel>

          <Panel className="summary-card">
            <p className="summary-card-title">Localization</p>
            <div className="summary-grid">
              <SummaryMetric label="Method" value={localizationMethod} title={DAE_LOCALIZATION_METHOD} />
              <SummaryMetric
                label="Boxes"
                value={visibleBoxes > 0 ? String(visibleBoxes) : boxesCount > 0 ? `${boxesCount} (hidden)` : "0"}
              />
              <SummaryMetric
                label="Note"
                value={shouldRenderPredictBoxes(currentResult) ? BOX_NOTE_SHORT : BBOX_DISCLAIMER_SHORT}
                truncate
                title={BBOX_DISCLAIMER_SHORT}
              />
            </div>
          </Panel>

          {isApiCategory(metrics.apiCategory) && (
            <TechnicalDetailsSection
              category={metrics.apiCategory}
              apiThreshold={currentResult?.scoreThreshold}
              thresholdMatchesArtifact={currentResult?.thresholdMatchesArtifact}
              bboxMethod={bboxMethod}
              experimentName={metrics.experimentName}
            />
          )}

          <Panel className="summary-card">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "status-dot",
                  apiHealth?.rawStatus === "ready" ? "status-dot--ok" : "status-dot--pending",
                )}
              />
              <p
                className={cn(
                  "metric-value text-[11px]",
                  apiHealth?.rawStatus === "ready" ? "text-lab-ok" : "text-lab-pending",
                )}
              >
                {apiHealth?.rawStatus === "ready"
                  ? "API ready"
                  : apiHealth?.rawStatus === "loading"
                    ? "Model loading"
                    : "API offline"}
              </p>
            </div>
          </Panel>

          {sessionMetrics.totalProcessed > 0 && (
            <Panel className="summary-card">
              <p className="summary-card-title">Session aggregate</p>
              <div className="summary-grid">
                <SummaryMetric
                  label="Processed"
                  value={
                    <AnimatedNumber value={sessionMetrics.totalProcessed} decimals={0} duration={400} />
                  }
                />
                <SummaryMetric
                  label="Anomaly rate"
                  value={
                    <AnimatedNumber
                      value={sessionMetrics.anomalyRate * 100}
                      decimals={1}
                      suffix="%"
                    />
                  }
                  tone={sessionMetrics.anomalyRate > 0 ? "anomaly" : "default"}
                />
                <SummaryMetric
                  label="Avg score"
                  value={<AnimatedNumber value={sessionMetrics.avgAnomalyScore} decimals={3} />}
                />
                <SummaryMetric
                  label="Avg latency"
                  value={
                    <AnimatedNumber
                      value={sessionMetrics.avgLatencyMs}
                      duration={400}
                      decimals={0}
                      suffix=" ms"
                    />
                  }
                />
              </div>
            </Panel>
          )}

          <div className="summary-footer-actions">
            <button
              type="button"
              onClick={() => useInspectionStore.getState().setShowCharts(true)}
              className="summary-compact-btn summary-compact-btn--accent w-full"
            >
              <BarChart3 className="h-3 w-3" />
              Session charts
            </button>
          </div>
        </div>
      </div>
    </SummaryShell>
  );
}
