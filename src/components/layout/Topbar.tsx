"use client";

import { Grid2x2, HelpCircle, Settings, SunMedium } from "lucide-react";
import { LabLogoMark } from "@/components/brand/LabLogoMark";
import { IconButton } from "@/components/ui/IconButton";
import { useInspectionStore } from "@/store/inspection-store";
import { cn } from "@/lib/utils";

interface TopbarProps {
  sessionDate: string;
  sessionTime: string;
}

export function Topbar({ sessionDate, sessionTime }: TopbarProps) {
  const apiHealth = useInspectionStore((s) => s.apiHealth);
  const isLineRunning = useInspectionStore((s) => s.isLineRunning);
  const modelMetadata = useInspectionStore((s) => s.modelMetadata);

  const isLive = apiHealth?.status === "online" && apiHealth.modelLoaded;
  const badgeLabel = isLineRunning ? "Running" : isLive ? "Live" : "Offline";

  return (
    <header className="lab-topbar flex shrink-0 items-center justify-between px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <LabLogoMark size={18} className="lab-topbar__logo" />
        <div className="min-w-0">
          <p className="lab-topbar__title">COMPARISON LAB</p>
          <p className="lab-topbar__subtitle truncate">
            Bottle Anomaly Inspection
            {modelMetadata?.experimentName
              ? ` · ${modelMetadata.experimentName.replace(/_/g, " ")}`
              : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="lab-topbar__session">SESSION {sessionDate}</span>
        <span className="lab-topbar__session text-lab-cream">{sessionTime}</span>
        <span
          className={cn(
            "lab-topbar__badge inline-flex items-center gap-1.5",
            !isLive && "border-[rgba(224,122,95,0.3)] bg-[rgba(224,122,95,0.12)] text-lab-anomaly",
          )}
        >
          {isLive && <span className="lab-topbar__badge-dot" aria-hidden />}
          {badgeLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="batch-btn hidden sm:inline-flex"
        >
          <Grid2x2 className="h-3 w-3" />
          View Mode
        </button>
        <IconButton label="Display">
          <SunMedium className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Help">
          <HelpCircle className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Settings">
          <Settings className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </header>
  );
}
