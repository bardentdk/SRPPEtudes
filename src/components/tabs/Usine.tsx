"use client";

import type { Dashboard } from "@/lib/types";
import { fmt, usineEthanol, type Verdict } from "@/lib/analysis";
import { USINE, USINE_1G, USINE_2G, type Valeurs } from "@/lib/hypotheses";
import { Card, Hypotheses, Segmented, VerdictBadge } from "../ui";
import { HStack } from "../charts";
import type { Tokens } from "../useTokens";

type Bilan = ReturnType<typeof usineEthanol>;

const verdictUsine = (b: Bilan): Verdict => (b.van > 0 ? "viable" : b.ebe > 0 ? "fragile" : "non_viable");

function Colonne({ titre, sousTitre, b, tokens }: { titre: string; sousTitre: string; b: Bilan; tokens: Tokens }) {
  const lignes: [string, string][] = [
    ["Matière première", b.filiere === "1G" ? `${fmt.n(b.matiere)} t de mélasse` : `${fmt.n(b.matiere)} t de paille sèche`],
    ["Capacité", `${fmt.m3(b.capacite)}/an d'éthanol`],
    ["Investissement", fmt.euros(b.capex)],
    ["Chiffre d'affaires", `${fmt.euros(b.ca)}/an`],
    ["Exploitation", `${fmt.euros(b.opex)}/an`],
    ["Achats de matière", `${fmt.euros(b.achats)}/an`],
    ...(b.filiere === "2G" ? [["Transport", `${fmt.euros(b.transport)}/an (${fmt.n1(b.distanceMoy)} km en moyenne)`] as [string, string]] : []),
    ["Excédent brut", `${fmt.euros(b.ebe)}/an`],
    ["Coût de revient", `${fmt.eur(b.coutRevient)}/L`],
    ["VAN", fmt.euros(b.van)],
    ["TRI", b.tri != null ? fmt.pct(b.tri) : "—"],
    ["Retour sur investissement", Number.isFinite(b.retour) ? `${fmt.n1(b.retour)} ans` : "jamais"],
    ["Emplois directs", `≈ ${b.emplois}`],
    ["Importations évitées", `${fmt.euros(b.importsEvites)}/an`],
  ];
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: b.filiere === "1G" ? tokens.s3 : tokens.s4 }} />{titre}</div>
          <p className="text-[12.5px] text-ink-2">{sousTitre}</p>
        </div>
        <VerdictBadge verdict={verdictUsine(b)} />
      </div>
      <dl className="tabular grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
        {lignes.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-2">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function UsineDetail({ data, u1, u2, sites, siteIdx, setSiteIdx, hU, setHU, h1, setH1, h2, setH2, tokens }: {
  data: Dashboard; u1: Bilan; u2: Bilan; sites: Dashboard["sucrerie"]; siteIdx: number; setSiteIdx: (i: number) => void;
  hU: Valeurs<typeof USINE>; setHU: (v: Valeurs<typeof USINE>) => void;
  h1: Valeurs<typeof USINE_1G>; setH1: (v: Valeurs<typeof USINE_1G>) => void;
  h2: Valeurs<typeof USINE_2G>; setH2: (v: Valeurs<typeof USINE_2G>) => void; tokens: Tokens;
}) {
  const couts = [u1, u2].map((b) => ({
    nom: b.filiere === "1G" ? "Mélasse (1G)" : "Paille (2G)",
    capital: b.litres ? b.capex / ((1 - (1 + hU.taux / 100) ** -hU.duree) / (hU.taux / 100)) / b.litres : 0,
    exploitation: b.litres ? b.opex / b.litres : 0,
    matiere: b.litres ? (b.achats + b.transport) / b.litres : 0,
  }));
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Paramètres de l'unité" subtitle="Investissements et coûts tirés d'usines existantes ; sources sous chaque curseur.">
        <div className="mb-5">
          <div className="mb-1.5 text-[13px] text-ink-2">Site d&apos;implantation</div>
          <Segmented label="Site" value={String(siteIdx)} onChange={(v) => setSiteIdx(Number(v))}
            options={sites.map((s, i) => ({ value: String(i), label: s.nom.replace("Usine ", "") }))} />
        </div>
        <div className="space-y-6">
          <Hypotheses defs={USINE} valeurs={hU} set={setHU} />
          <div className="border-t border-line pt-4"><div className="mb-3 text-[13px] font-semibold">Distillerie de mélasse (1G)</div><Hypotheses defs={USINE_1G} valeurs={h1} set={setH1} /></div>
          <div className="border-t border-line pt-4"><div className="mb-3 text-[13px] font-semibold">Unité de paille de canne (2G)</div><Hypotheses defs={USINE_2G} valeurs={h2} set={setH2} /></div>
        </div>
      </Card>
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <Colonne titre="Distillerie de mélasse (1G)" sousTitre={`Adossée à l'usine sucrière ; ${fmt.n(hU.duree)} ans d'exploitation`} b={u1} tokens={tokens} />
          <Colonne titre="Unité de paille de canne (2G)" sousTitre={`Paille collectée dans un rayon de ${hU.rayon} km (${fmt.n(u2.surfaceCaptee)} ha de canne)`} b={u2} tokens={tokens} />
        </div>
        <Card title="Coût de revient d'un litre d'éthanol" subtitle={`Comparé au prix de marché de ${fmt.eur(hU.prixVente)} : l'investissement est annualisé au taux de ${fmt.n1(hU.taux)} %.`}>
          <HStack data={couts} tokens={tokens} format={fmt.eur} series={[
            { key: "capital", label: "Investissement annualisé", color: tokens.s1 },
            { key: "exploitation", label: "Exploitation", color: tokens.s2 },
            { key: "matiere", label: "Matière et transport", color: tokens.s3 },
          ]} />
        </Card>
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Campagne de référence : {fmt.n(u1.campagne.tonnes)} t de canne ({u1.campagne.annee}). La capacité est celle que permet la ressource mobilisable :
          ajustez la part de mélasse ou de paille dans l&apos;onglet Filière, ou le rayon de collecte ci-contre. Le site choisi apparaît sur la carte avec son rayon.
          L&apos;éthanol déjà produit à Rivière du Mât pour la turbine d&apos;Albioma montre que la filière 1G existe sur l&apos;île ; {data.sucrerie.filter((s) => s.type === "balance").length} balances de canne alimentent les deux usines.
        </p>
      </div>
    </div>
  );
}
