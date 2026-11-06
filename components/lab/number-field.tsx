"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Numeric input that lets you type freely and only commits valid numbers inside [min, max].
 * Invalid input shows an inline error instead of silently changing the value.
 */
export function NumberField({
  label,
  value,
  onCommit,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  integer = false,
  suffix,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  const parsed = Number(text);
  const error =
    draft === null
      ? null
      : text.trim() === "" || !Number.isFinite(parsed)
        ? "Enter a number"
        : integer && !Number.isInteger(parsed)
          ? "Whole numbers only"
          : parsed < min
            ? `Min ${min}`
            : parsed > max
              ? `Max ${max.toLocaleString()}`
              : null;

  const commit = () => {
    if (draft !== null && !error) onCommit(parsed);
    setDraft(null);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          disabled={disabled}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const n = Number(v);
            const ok = v.trim() !== "" && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
            if (ok) onCommit(n);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(null);
          }}
          className="h-8 pr-12 font-mono text-[13px]"
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {(error || hint) && (
        <p id={`${id}-msg`} className={error ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Range slider for fractions 0..1 shown as a percentage. */
export function FractionField({
  label,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <span className="font-mono text-[12px]">{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full accent-[var(--brand-blue)] disabled:opacity-50"
      />
      {hint && (
        <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
