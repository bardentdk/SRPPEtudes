"use client";

import type { Public } from "@/lib/types";
import { labelDe, optionsDe, type Question, type Valeur } from "@/lib/questionnaire/schema";
import { NOMS_COMMUNES } from "@/lib/questionnaire/communes";
import { fmt } from "@/lib/analysis";

const SURCONSO_E85 = 1.25; // un véhicule consomme environ 25 % de plus en E85
const PRIX_SP95 = 2.0;

function formatUnite(v: number, unite: string) {
  if (unite === "€/L") return `${fmt.eur(v)}/L`;
  if (unite === "€") return `${fmt.n(v)} €`;
  if (unite === "%") return `${fmt.n(v)} %`;
  return `${fmt.n(v)} ${unite}`;
}

export function Champ({ q, valeur, onChange, erreur, pub }: {
  q: Question; valeur: Valeur | undefined; onChange: (v: Valeur) => void; erreur?: string; pub: Public | null;
}) {
  const id = `q-${q.id}`;
  const label = labelDe(q, pub);
  return (
    <fieldset className="space-y-2.5" aria-describedby={erreur ? `${id}-erreur` : undefined}>
      <legend className="text-[15px] font-medium leading-snug">
        {label}
        {q.requis && <span className="ml-1 text-critical" aria-label="obligatoire">*</span>}
      </legend>
      {q.aide && <p className="text-[12.5px] text-ink-2">{q.aide}</p>}

      {(q.type === "choix" || q.type === "multi") && (
        <div className="grid gap-2 sm:grid-cols-2">
          {optionsDe(q, pub).map((o) => {
            const coche = q.type === "choix" ? valeur === o : Array.isArray(valeur) && valeur.includes(o);
            const basculer = () => {
              if (q.type === "choix") return onChange(o);
              const liste = Array.isArray(valeur) ? valeur : [];
              onChange(coche ? liste.filter((x) => x !== o) : [...liste, o]);
            };
            return (
              <label key={o} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-[14px] transition-colors ${coche ? "border-s1 bg-s1/10" : "border-line bg-surface hover:bg-surface-2"}`}>
                <input type={q.type === "choix" ? "radio" : "checkbox"} name={id} checked={coche} onChange={basculer} className="mt-0.5 accent-[var(--s1)]" />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.type === "curseur" && (() => {
        const v = typeof valeur === "number" ? valeur : q.defaut;
        return (
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-muted">{formatUnite(q.min, q.unite)}</span>
              <output htmlFor={id} className="tabular text-[22px] font-semibold tracking-tight">{formatUnite(v, q.unite)}</output>
              <span className="text-[12px] text-muted">{formatUnite(q.max, q.unite)}</span>
            </div>
            <input id={id} type="range" min={q.min} max={q.max} step={q.pas} value={v} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full" />
            {q.id === "wtpe85" && (
              <p className="mt-2 text-[12.5px] text-ink-2">
                Pour la même distance, cela revient à <strong>{fmt.eur(v * SURCONSO_E85)}</strong> par litre de SP95 remplacé
                {" "}({v * SURCONSO_E85 < PRIX_SP95 ? `${fmt.eur(PRIX_SP95 - v * SURCONSO_E85)} de moins` : `${fmt.eur(v * SURCONSO_E85 - PRIX_SP95)} de plus`} qu&apos;un SP95 à {fmt.eur(PRIX_SP95)}).
              </p>
            )}
            {q.id.startsWith("wtp98") && v === 0 && <p className="mt-2 text-[12.5px] text-ink-2">0 € : vous n&apos;achèteriez pas de SP98 plus cher que le SP95.</p>}
          </div>
        );
      })()}

      {q.type === "nombre" && (
        <div className="flex items-center gap-2">
          <input id={id} type="number" inputMode="numeric" min={q.min} max={q.max} value={typeof valeur === "number" ? valeur : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className="w-44 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] tabular" />
          <span className="text-[13px] text-ink-2">{q.unite}</span>
        </div>
      )}

      {q.type === "echelle" && (
        <div>
          <div className="flex gap-2" role="radiogroup" aria-label={label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={valeur === n} onClick={() => onChange(n)}
                className={`h-11 flex-1 rounded-xl border text-[15px] font-semibold transition-colors ${valeur === n ? "border-s1 bg-s1 text-white" : "border-line bg-surface hover:bg-surface-2"}`}>
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[12px] text-muted"><span>{q.bas}</span><span>{q.haut}</span></div>
        </div>
      )}

      {q.type === "commune" && (
        <select id={id} value={typeof valeur === "string" ? valeur : ""} onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] sm:w-80">
          <option value="">Choisir une commune</option>
          {NOMS_COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {q.type === "texte" && (q.long ? (
        <textarea id={id} rows={4} maxLength={2000} value={typeof valeur === "string" ? valeur : ""} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px]" />
      ) : (
        <input id={id} type={q.email ? "email" : "text"} maxLength={200} autoComplete={q.email ? "email" : q.id === "contact_nom" ? "name" : q.id === "contact_structure" ? "organization" : "off"}
          value={typeof valeur === "string" ? valeur : ""} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] sm:w-96" />
      ))}

      {erreur && <p id={`${id}-erreur`} className="text-[13px] font-medium text-critical" role="alert">{erreur}</p>}
    </fieldset>
  );
}
