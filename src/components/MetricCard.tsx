import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "green" | "amber" | "ink";
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "green",
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__icon" aria-hidden="true">
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}
