export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="bg-aurora relative">
      <div className="flex flex-col gap-5 px-6 pb-6 pt-9 sm:flex-row sm:items-end sm:justify-between md:px-10">
        <div className="space-y-2">
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">{eyebrow}</p>}
          <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
          {description && <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
