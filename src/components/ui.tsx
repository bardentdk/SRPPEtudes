"use client";

import type { ReactNode } from "react";
import type { Hypothese } from "@/lib/hypotheses";
import type { Verdict } from "@/lib/analysis";

export function Card({ title, subtitle, actions, children, className = "" }: {
  title?: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-muted">
        {accent && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
        {label}
      </div>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-[12px] text-ink-2">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ h, value, onChange, format }: {
  h: Hypothese; value: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const shown = format ? format(value) : `${value.toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0")} ${h.unite}`;
  return (
    <label className="block" title={h.note || undefined}>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-ink-2">{h.label}</span>
        <span className="tabular shrink-0 font-semibold">{shown}</span>
      </div>
      <input
        type="range"
        min={h.min}
        max={h.max}
        step={h.pas}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full"
      />
      {(h.note || h.source) && (
        <p className="text-[11.5px] leading-snug text-muted">
          {h.note}
          {h.source && (
            <>
              {" "}
              <a href={h.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                Source : {h.source.titre}
              </a>
            </>
          )}
        </p>
      )}
    </label>
  );
}

/** Liste de curseurs pour un jeu d'hypothèses. */
export function Hypotheses<T extends Record<string, Hypothese>>({ defs, valeurs, set, cles }: {
  defs: T; valeurs: { [K in keyof T]: number }; set: (v: { [K in keyof T]: number }) => void; cles?: (keyof T)[];
}) {
  return (
    <div className="space-y-4">
      {(cles ?? (Object.keys(defs) as (keyof T)[])).map((k) => (
        <Slider key={String(k)} h={defs[k]} value={valeurs[k]} onChange={(v) => set({ ...valeurs, [k]: v })} />
      ))}
    </div>
  );
}

/** Message affiché à la place d'un bloc tant que les données nécessaires manquent. */
export function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line bg-surface-2 p-4 text-[13px] text-ink-2">{children}</p>;
}

export function Toggle({ checked, onChange, label, swatch }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; swatch?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-s1 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
      {swatch && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />}
      <span>{label}</span>
    </label>
  );
}

const VERDICTS: Record<Verdict, { label: string; color: string; icon: string }> = {
  viable: { label: "Viable", color: "var(--good)", icon: "✓" },
  fragile: { label: "Fragile", color: "var(--warning)", icon: "!" },
  non_viable: { label: "Non viable", color: "var(--critical)", icon: "✕" },
};

export function VerdictBadge({ verdict, large }: { verdict: Verdict; large?: boolean }) {
  const v = VERDICTS[verdict];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface font-semibold ${large ? "px-4 py-2 text-[15px]" : "px-2.5 py-1 text-[12px]"}`}>
      <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] text-white" style={{ background: v.color }} aria-hidden>
        {v.icon}
      </span>
      {v.label}
    </span>
  );
}

export function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] text-white" style={{ background: ok ? "var(--good)" : "var(--critical)" }} aria-label={ok ? "condition remplie" : "condition non remplie"}>
        {ok ? "✓" : "✕"}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Ligne d'information neutre : un constat mesuré, sans jugement réussi/échoué. */
export function Mesure({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-s1 text-[10px] font-semibold text-white" aria-hidden>i</span>
      <span>{children}</span>
    </li>
  );
}

export type Ton = "succes" | "erreur" | "attention" | "info";

const TONS: Record<Ton, { couleur: string; icone: string; libelle: string }> = {
  succes: { couleur: "var(--good)", icone: "✓", libelle: "Succès" },
  erreur: { couleur: "var(--critical)", icone: "✕", libelle: "Erreur" },
  attention: { couleur: "var(--warning)", icone: "!", libelle: "Attention" },
  info: { couleur: "var(--s1)", icone: "i", libelle: "Information" },
};

/** Bandeau de retour d'action : couleur, icône et libellé, pour ne jamais reposer sur la couleur seule. */
export function Alerte({ ton, children, onFermer }: { ton: Ton; children: ReactNode; onFermer?: () => void }) {
  const t = TONS[ton];
  return (
    <div role={ton === "erreur" ? "alert" : "status"}
      className="flex items-start gap-3 rounded-xl border p-3.5 text-[13.5px]"
      style={{ borderColor: t.couleur, background: `color-mix(in srgb, ${t.couleur} 12%, var(--surface))` }}>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: t.couleur }} aria-hidden>{t.icone}</span>
      <div className="flex-1"><strong className="mr-1.5">{t.libelle} :</strong>{children}</div>
      {onFermer && <button onClick={onFermer} className="text-ink-2 hover:text-ink" aria-label="Fermer le message">✕</button>}
    </div>
  );
}
