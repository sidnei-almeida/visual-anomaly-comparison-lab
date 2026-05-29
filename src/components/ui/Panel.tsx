import { cn } from "@/lib/utils";

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div className={cn("rounded-sm border border-lab-border bg-lab-panel", className)}>{children}</div>
  );
}
