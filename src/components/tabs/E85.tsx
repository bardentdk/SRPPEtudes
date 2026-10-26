"use client";

import type { Dashboard } from "@/lib/types";
import { fmt, scenarioE85, type QuestionnaireActif, type SourceDemande } from "@/lib/analysis";
import { E85, type Valeurs } from "@/lib/hypotheses";
import { Card, Check, Hypotheses, Kpi, Mesure, Segmented, VerdictBadge } from "../ui";
import { HStack, SimpleBars } from "../charts";
import type { Tokens } from "../useTokens";
import { SourceDemandeChoix } from "./Sp98";

type Scenario = ReturnType<typeof scenarioE85>;

export function E85Synthese({ e85, prixSP95, q, tokens }: { e85: Scenario; prixSP95: number; q: QuestionnaireActif | null; tokens: Tokens }) {
  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Verdict du scénario</div>
          <VerdictBadge verdict={e85.verdict} large />
        </div>
        <ul className="mt-4 space-y-2">
          <Check ok={e85.prixOk}>À distance égale, l&apos;E85 coûte <strong>{fmt.eur(e85.prixEquivalent)}</strong> contre {fmt.eur(prixSP95)} pour le SP95</Check>
          <Check ok={e85.ressourceOk}>L&apos;offre locale couvre <strong>{fmt.pct(e85.couverture)}</strong> de la demande</Check>
          <Check ok={e85.electriciteOk}>{e85.electriciteOk ? "Aucune bagasse retirée aux centrales électriques" : <><strong>{fmt.n(e85.electricitePerdue)} MWh</strong> d&apos;électricité perdus (bagasse détournée)</>}</Check>
          {e85.source === "questionnaire" && (
            <Mesure>Questionnaire : à {fmt.eur(e85.prixE85)} le litre, <strong>{fmt.pct(e85.adoption)}</strong> d&apos;adoption déclarée chez les {q!.reponses} répondants</Mesure>
          )}
        </ul>
      </div>
      <Kpi accent={tokens.s3} label="Prix E85 estimé" value={fmt.eur(e85.prixE85)} hint={`coût moyen de l'éthanol local ${fmt.eur(e85.coutEthanol)}/L`} />
      <Kpi accent={tokens.s3} label="Chiffre d'affaires E85" value={fmt.euros(e85.chiffreAffaires)} hint={`${fmt.m3(e85.ventes / 1000)} vendus par an`} />
      <Kpi accent={tokens.s3} label="Essence importée évitée" value={fmt.m3(e85.essenceEvitee)} hint={`${fmt.pct(e85.partEssenceEvitee)} de la consommation de l'île`} />
    </div>
  );
}

export function E85Filiere({ data, e85, h, setH, campagne, setCampagne, source, setSource, q, tokens }: {
  data: Dashboard; e85: Scenario; h: Valeurs<typeof E85>; setH: (v: Valeurs<typeof E85>) => void;
  campagne: number; setCampagne: (a: number) => void; source: SourceDemande; setSource: (v: SourceDemande) => void;
  q: QuestionnaireActif | null; tokens: Tokens;
}) {
  const enE85m3 = (litresEthanol: number) => litresEthanol / (h.partEthanolE85 / 100) / 1000;
  const bilan = [
    { nom: "Offre locale", melasse: enE85m3(e85.ethMelasse), paille: enE85m3(e85.ethPaille), bagasse: enE85m3(e85.ethBagasse), demande: 0 },
    { nom: "Demande", melasse: 0, paille: 0, bagasse: 0, demande: e85.demandeE85 / 1000 },
  ];
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Hypothèses de la filière" subtitle="Rendements et parts mobilisables. Les coûts de l'éthanol viennent de l'onglet Unité de production.">
        <div className="mb-5">
          <div className="mb-1.5 text-[13px] text-ink-2">Campagne sucrière de référence</div>
          <Segmented label="Campagne" value={String(campagne)} onChange={(v) => setCampagne(Number(v))}
            options={data.campagnes.map((c) => ({ value: String(c.annee), label: String(c.annee) }))} />
        </div>
        <Hypotheses defs={E85} valeurs={h} set={setH} />
      </Card>
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-5 text-[13.5px] leading-relaxed">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] text-white" style={{ background: "var(--warning)" }} aria-hidden>!</span>
            La canne n&apos;est pas un déchet aujourd&apos;hui
          </div>
          <p className="text-ink-2">
            La <strong>bagasse</strong> alimente les centrales de Bois-Rouge et du Gol. La <strong>mélasse</strong> alimente les distilleries de rhum, et déjà de l&apos;éthanol :
            la distillerie de Rivière du Mât fournit la turbine éthanol d&apos;Albioma à Saint-Pierre. La ressource réellement libre est la <strong>paille</strong> laissée au champ,
            qui demande un éthanol de 2e génération, plus coûteux.
          </p>
        </div>
        <Card title="E85 : offre locale face à la demande" subtitle={`En m³ d'E85 par an. ${fmt.n(e85.vpFlex)} VP flex-fuel (${fmt.n1(h.partFlex)} % des VP essence), surconsommation incluse.`}
          actions={<SourceDemandeChoix value={source} onChange={setSource} q={q} />}>
          <HStack data={bilan} tokens={tokens} format={(v) => `${fmt.n(v)} m³`} series={[
            { key: "melasse", label: "Mélasse (1G)", color: tokens.s3 },
            { key: "paille", label: "Paille (2G)", color: tokens.s4 },
            { key: "bagasse", label: "Bagasse détournée (2G)", color: tokens.s2 },
            { key: "demande", label: "Demande", color: tokens.s1 },
          ]} />
        </Card>
        <Card title="Tonnages des campagnes sucrières" subtitle="Tonnes de cannes broyées par les deux usines (DAAF). 2024 est la plus faible campagne de l'histoire moderne.">
          <SimpleBars data={data.campagnes.map((c) => ({ annee: c.annee, v: c.tonnes }))} color={tokens.s2} tokens={tokens} format={(v) => `${fmt.n(v)} t`} />
        </Card>
      </div>
    </div>
  );
}
