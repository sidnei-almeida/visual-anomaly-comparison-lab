import { cn } from "@/lib/utils";

interface LabLogoMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Minimal inspection reticle — red focal point on black. Used in topbar, splash, favicon. */
export function LabLogoMark({
  size = 24,
  className,
  title = "Comparison Lab",
}: LabLogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <rect width="24" height="24" rx="2" fill="#0A0A0A" />
      <circle cx="12" cy="12" r="2.25" fill="#E63329" />
      <path
        stroke="#555555"
        strokeWidth="1.25"
        strokeLinecap="square"
        d="M12 5v4.25M12 14.75V19M5 12h4.25M14.75 12H19"
      />
    </svg>
  );
}
