"use client";

import type { Dashboard } from "@/lib/types";
import {
  economieSP98, fmt, lirePalier, scenarioSP98, type QuestionnaireActif, type SourceDemande, classementImplantation,
} from "@/lib/analysis";
import { SP98, type Valeurs } from "@/lib/hypotheses";
import { Card, Check, Hypotheses, Kpi, Mesure, Segmented, VerdictBadge } from "../ui";
import { CourbeXY, HStack } from "../charts";
import type { Tokens } from "../useTokens";

type Scenario = ReturnType<typeof scenarioSP98>;
type Economie = ReturnType<typeof economieSP98>;
type Pilote = ReturnType<typeof classementImplantation>[number];

export function SourceDemandeChoix({ value, onChange, q }: { value: SourceDemande; onChange: (v: SourceDemande) => void; q: QuestionnaireActif | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[13px] text-ink-2">Demande issue de</span>
      <Segmented label="Source de la demande" value={value} onChange={onChange}
        options={[{ value: "questionnaire", label: `Questionnaire${q ? ` (${q.reponses})` : ""}` }, { value: "hypothese", label: "Hypothèse" }]} />
      {value === "questionnaire" && !q && <span className="text-[12px] text-muted">Aucune réponse disponible : l&apos;hypothèse s&apos;applique.</span>}
    </div>
  );
}

export function Sp98Synthese({ sp98, eco, h, q, tokens }: {
  sp98: Scenario; eco: Economie; h: Valeurs<typeof SP98>; q: QuestionnaireActif | null; tokens: Tokens;
}) {
  const declare = q?.prix_sp98?.global ? lirePalier(q.prix_sp98.global, sp98.surcoutTTC) : null;
  const auCout = eco.a(sp98.surcoutTTC);
  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Verdict du scénario</div>
          <VerdictBadge verdict={sp98.verdict} large />
        </div>
        <ul className="mt-4 space-y-2">
          <Check ok={sp98.prixOk}>Surcoût à la pompe de <strong>{fmt.eur(sp98.surcoutTTC)}</strong> pour un maximum acceptable de {fmt.eur(h.primeAcceptable)}</Check>
          <Check ok={sp98.stationsOk}><strong>{fmt.m3(sp98.volParStation)}</strong> par pompe pilote pour un minimum de {fmt.m3(h.volMinStation)}</Check>
          {declare && (
            <Mesure>
              Questionnaire : à ce surcoût, <strong>{fmt.pct(declare.chaque)}</strong> des {q!.reponses} répondants achèteraient du SP98 à chaque fois, {fmt.pct(declare.auMoinsParfois)} au moins de temps en temps
            </Mesure>
          )}
        </ul>
      </div>
      <Kpi accent={tokens.s1} label="Prix SP98 estimé" value={fmt.eur(sp98.prixSP98)} hint={`pour un SP95 à ${fmt.eur(h.prixSP95)}`} />
      <Kpi accent={tokens.s1} label="Résultat annuel de la filière" value={fmt.euros(auCout.resultat * 1000)}
        hint={`au surcoût de ${fmt.eur(auCout.surcout)} · ${eco.source === "questionnaire" ? "demande déclarée" : "demande supposée"}`} />
      <Kpi label="Surcoût le plus rentable" value={fmt.eur(eco.optimum.surcout)}
        hint={`résultat ${fmt.euros(eco.optimum.resultat * 1000)} pour ${fmt.m3(eco.optimum.volume)}`} />
    </div>
  );
}

export function Sp98Detail({ data, sp98, eco, h, setH, pilotes, source, setSource, q, tokens, onImplantation }: {
  data: Dashboard; sp98: Scenario; eco: Economie; h: Valeurs<typeof SP98>; setH: (v: Valeurs<typeof SP98>) => void;
  pilotes: Pilote[]; source: SourceDemande; setSource: (v: SourceDemande) => void; q: QuestionnaireActif | null; tokens: Tokens;
  onImplantation: () => void;
}) {
  const d = sp98.decomposition;
  const prix = [
    { nom: "SP95", base: h.prixSP95, produit: 0, logistique: 0, marge: 0, tva: 0 },
    { nom: "SP98 estimé", base: h.prixSP95, produit: d.produit, logistique: Math.min(d.logistique, 2), marge: d.marge, tva: d.tva },
  ];
  const volumes = [
    { nom: "Par la conso", descendant: sp98.volDescendant, vp: 0, motos: 0 },
    { nom: "Par le parc", descendant: 0, vp: sp98.volVp, motos: sp98.volMotos },
  ];
  const auCout = eco.a(sp98.surcoutTTC);
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Hypothèses du scénario" subtitle="Ordres de grandeur à confirmer. Les sources publiques sont citées sous chaque curseur.">
        <Hypotheses defs={SP98} valeurs={h} set={setH} />
      </Card>
      <div className="space-y-4">
        <Card title="Économie de la filière selon le surcoût pratiqué"
          subtitle="Plus le SP98 est cher, moins il s'en vend : la courbe donne le résultat annuel (importateur et logistique, après coûts fixes et amortissement des pompes)."
          actions={<SourceDemandeChoix value={source} onChange={setSource} q={q} />}>
          <CourbeXY data={eco.points} x="surcout" y="resultat" color={tokens.s1} tokens={tokens}
            formatX={(v) => `+${fmt.eur(v)}`} formatY={(v) => fmt.euros(v * 1000)}
            reperes={[
              { x: Math.round(sp98.surcoutTTC * 100) / 100, label: "prix de revient", color: tokens.ink2 },
              { x: eco.optimum.surcout, label: "optimum", color: tokens.s1 },
            ].filter((r) => r.x >= 0.05 && r.x <= 0.4)} />
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Kpi label="Volume vendu" value={fmt.m3(auCout.volume)} hint={`au surcoût de ${fmt.eur(auCout.surcout)}`} />
            <Kpi label="Chiffre d'affaires TTC" value={fmt.euros(auCout.ca * 1000)} />
            <Kpi label="Marge des stations" value={fmt.euros(auCout.margeStations * 1000)} hint={`${fmt.eur(eco.marge)}/L${eco.source === "questionnaire" && q?.stations?.marge_mediane != null ? " (déclarée)" : ""}`} />
            <Kpi label="Coûts fixes annuels" value={fmt.euros(eco.fixes * 1000)} hint="logistique + pompes amorties" />
          </div>
          <p className="mt-3 text-[12.5px] text-ink-2">
            {eco.source === "questionnaire"
              ? <>Demande déclarée : {fmt.pct(eco.eligible)} de l&apos;essence concernée par le SP98 (médiane des professionnels ou hypothèse), multipliée par la part qui l&apos;achèterait à chaque surcoût.</>
              : <>Demande supposée : {fmt.n1(h.captation)} % de l&apos;essence à +0,10 €/L, nulle à +{fmt.eur(h.prixRejet)}.</>}
            {eco.plageRentable
              ? <> La filière est bénéficiaire entre +{fmt.eur(eco.plageRentable[0])} et +{fmt.eur(eco.plageRentable[1])}.</>
              : <> Aucun surcoût entre +0,05 € et +0,40 € ne la rend bénéficiaire avec ces hypothèses.</>}
          </p>
        </Card>
        <Card title="Formation du prix à la pompe" subtitle="Le coût fixe de la filière dédiée est réparti sur le volume vendu.">
          <HStack data={prix} tokens={tokens} format={fmt.eur} series={[
            { key: "base", label: "Prix SP95", color: tokens.axis },
            { key: "produit", label: "Produit et fret", color: tokens.s1 },
            { key: "logistique", label: "Logistique et pompes", color: tokens.s2 },
            { key: "marge", label: "Marge distributeur", color: tokens.s3 },
            { key: "tva", label: "TVA 8,5 %", color: tokens.s4 },
          ]} />
        </Card>
        <Card title="Volume de SP98 : deux estimations croisées" subtitle="Le volume du verdict est le plus faible des deux (approche prudente).">
          <HStack data={volumes} tokens={tokens} format={fmt.m3} series={[
            { key: "descendant", label: `${fmt.n1(h.captation)} % de l'essence vendue`, color: tokens.s1 },
            { key: "vp", label: "VP où le 98 est préconisé", color: tokens.s2 },
            { key: "motos", label: `Motos neuves ${data.immat.periode_motos}`, color: tokens.s3 },
          ]} />
        </Card>
        <Card title={`Stations pilotes (${pilotes.length})`} subtitle="Choisies dans l'onglet Implantation, selon les facteurs et les poids que vous y réglez."
          actions={<button onClick={onImplantation} className="rounded-xl border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2">Régler l&apos;implantation</button>}>
          <ol className="grid gap-1.5 text-[13px] sm:grid-cols-2">
            {pilotes.map((st, i) => (
              <li key={st.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                <span><strong>{i + 1}.</strong> {st.nom}</span>
                <span className="tabular text-ink-2">score {st.score}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
