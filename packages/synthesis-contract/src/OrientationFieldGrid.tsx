import type { OrientationSummaryField } from "./types";

type OrientationFieldGridProps = {
  fields: OrientationSummaryField[];
  emptyMessage?: string;
  fieldClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
};

export function OrientationFieldGrid({
  fields,
  emptyMessage = "Aucun élément d'orientation renseigné.",
  fieldClassName = "rounded-xl border border-neutral-border/50 bg-neutral-surface-muted/40 px-3 py-2.5",
  labelClassName = "text-xs font-semibold uppercase tracking-wide text-neutral-text-muted",
  valueClassName = "mt-1 text-sm text-neutral-text whitespace-pre-wrap",
}: OrientationFieldGridProps) {
  if (fields.length === 0) {
    return <p className={`text-sm text-neutral-text-muted italic`}>{emptyMessage}</p>;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.id} className={fieldClassName}>
          <dt className={labelClassName}>{field.label}</dt>
          <dd className={valueClassName}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
