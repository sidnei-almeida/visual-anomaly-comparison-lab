"use client";

import { useEffect, useRef } from "react";
import type { DashboardSeverity } from "@/types/inference";
import {
  clampGaugeRatio,
  describeGaugeArcSegment,
  GAUGE_MAX_RATIO,
  GAUGE_THRESHOLD_RATIO,
  gaugeZoneColor,
  polarOnGaugeArc,
} from "@/lib/gauge-utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils";

export interface StatusGaugeProps {
  status: string;
  anomalyScore: number | null;
  threshold: number | null;
  ratio: number | null;
  severity: DashboardSeverity;
  isAnomaly?: boolean;
}

const VIEW_W = 200;
const VIEW_H = 128;
const CX = 100;
const CY = 96;
const R_ARC = 68;
const R_NEEDLE = 58;

const ARC_ZONES: Array<{ from: number; to: number; color: string }> = [
  { from: 0, to: GAUGE_THRESHOLD_RATIO, color: "var(--ok)" },
  { from: GAUGE_THRESHOLD_RATIO, to: GAUGE_MAX_RATIO, color: "var(--anomaly)" },
];

const TICK_RATIOS = [0, 0.5, GAUGE_THRESHOLD_RATIO, 1.5, GAUGE_MAX_RATIO] as const;

function formatRatio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}×`;
}

function formatScore(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

const severityTone: Record<DashboardSeverity, string> = {
  Normal: "text-lab-ok",
  Low: "text-lab-anomaly/80",
  Medium: "text-lab-anomaly",
  High: "text-lab-anomaly",
};

export function StatusGauge({
  status,
  anomalyScore,
  threshold,
  ratio,
  severity,
  isAnomaly = false,
}: StatusGaugeProps) {
  const clampedRatio = clampGaugeRatio(ratio ?? 0);
  const needleTip = polarOnGaugeArc(CX, CY, R_NEEDLE, clampedRatio);
  const accent = gaugeZoneColor(ratio);
  const displayStatus = status.toUpperCase();
  const statusRef = useRef(displayStatus);
  const statusFlashRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (statusRef.current === displayStatus) return;
    statusRef.current = displayStatus;
    statusFlashRef.current?.classList.remove("status-gauge__status--flash");
    void statusFlashRef.current?.offsetWidth;
    statusFlashRef.current?.classList.add("status-gauge__status--flash");
  }, [displayStatus]);

  return (
    <div className="status-gauge">
      <div className="status-gauge__dial" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="status-gauge__svg"
          role="img"
          aria-label={`${displayStatus}, ratio ${formatRatio(ratio)}, severity ${severity}`}
        >
          <defs>
            <linearGradient id="status-gauge-hub" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#241810" />
              <stop offset="100%" stopColor="#100b07" />
            </linearGradient>
          </defs>

          <path
            d={describeGaugeArcSegment(CX, CY, R_ARC, 0, GAUGE_MAX_RATIO)}
            fill="none"
            stroke="var(--bg-3)"
            strokeWidth={10}
            strokeLinecap="round"
          />

          {ARC_ZONES.map((zone) => {
            const path = describeGaugeArcSegment(CX, CY, R_ARC, zone.from, zone.to);
            if (!path) return null;
            return (
              <path
                key={`${zone.from}-${zone.to}`}
                d={path}
                fill="none"
                stroke={zone.color}
                strokeWidth={8}
                strokeLinecap="butt"
                opacity={0.9}
              />
            );
          })}

          {(() => {
            const tick = polarOnGaugeArc(CX, CY, R_ARC + 5, GAUGE_THRESHOLD_RATIO);
            const inner = polarOnGaugeArc(CX, CY, R_ARC - 10, GAUGE_THRESHOLD_RATIO);
            return (
              <line
                x1={inner.x}
                y1={inner.y}
                x2={tick.x}
                y2={tick.y}
                stroke="var(--cream-55)"
                strokeWidth={1.5}
              />
            );
          })()}

          {TICK_RATIOS.filter((t) => t !== GAUGE_THRESHOLD_RATIO).map((tick) => {
            const outer = polarOnGaugeArc(CX, CY, R_ARC + 4, tick);
            const inner = polarOnGaugeArc(CX, CY, R_ARC - 2, tick);
            return (
              <line
                key={tick}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="var(--warm-gray)"
                strokeWidth={1}
                opacity={0.6}
              />
            );
          })}

          <line
            x1={CX}
            y1={CY}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={accent}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={5} fill="url(#status-gauge-hub)" stroke="var(--border-2)" strokeWidth={1} />
          <circle cx={CX} cy={CY} r={1.75} fill={accent} />
        </svg>

        <div className="status-gauge__center">
          <span
            ref={statusFlashRef}
            className={cn(
              "status-gauge__status",
              isAnomaly ? "status-gauge__status--anomaly" : "status-gauge__status--ok",
            )}
          >
            {displayStatus}
          </span>
          <span className="status-gauge__ratio" style={{ color: accent }}>
            <AnimatedNumber value={ratio} decimals={2} suffix="×" />
          </span>
        </div>
      </div>

      <div className="status-gauge__meta">
        <p className="status-gauge__meta-line">
          score / threshold{" "}
          <span className="text-lab-cream">
            {formatScore(anomalyScore)} / {formatScore(threshold)}
          </span>
        </p>
        <p className="status-gauge__meta-line">
          Severity <span className={cn("font-medium", severityTone[severity])}>{severity}</span>
        </p>
      </div>
    </div>
  );
}
