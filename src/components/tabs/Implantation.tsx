"use client";

import { FACTEURS, classementImplantation, fmt, type Facteur, type Poids, type QuestionnaireActif } from "@/lib/analysis";
import { Card, Segmented, Slider, Vide } from "../ui";
import type { Tokens } from "../useTokens";

type Classees = ReturnType<typeof classementImplantation>;
export type Carburant = "sp98" | "e85";

const DEPEND_QUESTIONNAIRE: Facteur[] = ["demande", "zones"];

/** Réglages de l'implantation, affichés sous les filtres de la carte. */
export function ImplantationReglages({ carburant, setCarburant, poids, setPoids, nb, setNb, ecart, setEcart, q, site }: {
  carburant: Carburant; setCarburant: (c: Carburant) => void; poids: Poids; setPoids: (p: Poids) => void;
  nb: number; setNb: (n: number) => void; ecart: number; setEcart: (n: number) => void; q: QuestionnaireActif | null; site: string;
}) {
  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div>
        <div className="mb-1.5 text-[13px] text-ink-2">Carburant à implanter</div>
        <Segmented label="Carburant" value={carburant} onChange={setCarburant} options={[{ value: "sp98", label: "SP98" }, { value: "e85", label: "E85" }]} />
      </div>
      <Slider h={{ label: "Pompes à implanter", unite: "", defaut: 6, min: 1, max: 30, pas: 1, note: "" }} value={nb} onChange={setNb} format={(v) => `${v}`} />
      <Slider h={{ label: "Écart minimal entre deux pompes", unite: "km", defaut: 3, min: 0, max: 15, pas: 1, note: "Évite de concentrer les pilotes au même endroit." }} value={ecart} onChange={setEcart} />
      <div className="text-[13px] font-medium">Poids des facteurs</div>
      {(Object.keys(FACTEURS) as Facteur[]).map((k) => {
        const inactif = (DEPEND_QUESTIONNAIRE.includes(k) && !q) || (k === "usine" && carburant !== "e85");
        return (
          <div key={k} className={inactif ? "opacity-50" : ""}>
            <Slider value={poids[k]} onChange={(v) => setPoids({ ...poids, [k]: v })} format={(v) => `${v}`}
              h={{ label: FACTEURS[k].label, unite: "", defaut: 0, min: 0, max: 100, pas: 5,
                note: inactif ? (k === "usine" ? "Pris en compte pour l'E85 uniquement." : "Disponible dès que le questionnaire a des réponses.") : `${FACTEURS[k].note}${k === "usine" ? ` · site : ${site}` : ""}` }} />
          </div>
        );
      })}
    </div>
  );
}

export function ImplantationDetail({ pilotes, carburant, tokens }: { pilotes: Classees; carburant: Carburant; tokens: Tokens }) {
  const cles = Object.keys(FACTEURS) as Facteur[];
  if (!pilotes.length) return <Vide>Aucune station ne respecte l&apos;écart minimal demandé.</Vide>;
  return (
    <Card title={`Premières implantations ${carburant === "sp98" ? "SP98" : "E85"} proposées`}
      subtitle="Chaque barre montre la contribution d'un facteur (valeur normalisée entre la station la moins et la mieux placée). Les stations viennent de la BPE (INSEE), sans enseigne.">
      <div className="overflow-x-auto">
        <table className="tabular w-full text-left text-[13px]">
          <thead className="text-[11.5px] uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 pr-3">#</th><th className="pr-3">Commune</th><th className="pr-3 text-right">Score</th>
              {cles.map((k) => <th key={k} className="px-1 text-center font-medium normal-case" title={FACTEURS[k].label}>{FACTEURS[k].label.split(" ")[0]}</th>)}
            </tr>
          </thead>
          <tbody>
            {pilotes.map((st, i) => (
              <tr key={st.id} className="border-t border-line">
                <td className="py-2 pr-3 font-semibold">{i + 1}</td>
                <td className="pr-3">{st.nom}<div className="text-[11.5px] text-muted">{st.tmja_proche ? `${fmt.n(st.tmja_proche)} véh./j sur la RN` : `RN à ${fmt.n1(st.dist_rn_km)} km`}</div></td>
                <td className="pr-3 text-right font-semibold">{st.score}</td>
                {cles.map((k) => (
                  <td key={k} className="px-1">
                    <div className="mx-auto h-1.5 w-12 overflow-hidden rounded-full bg-surface-2" title={`${FACTEURS[k].label} : ${Math.round(st.parts[k] * 100)} %`}>
                      <div className="h-full rounded-full" style={{ width: `${st.parts[k] * 100}%`, background: tokens.s1 }} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
