"use client";

import Link from "next/link";
import type { CourbePrix, Dashboard, Public } from "@/lib/types";
import { fmt, lirePalier, type QuestionnaireActif } from "@/lib/analysis";
import { Card, Kpi, Vide } from "../ui";
import { Ranking, StackedBars } from "../charts";
import type { Tokens } from "../useTokens";

const PUBLICS: Record<Public, string> = {
  part: "Particuliers", pro: "Professionnels de l'auto", club: "Clubs", station: "Stations et distributeurs", filiere: "Filière canne",
};

const barres = (c: Record<string, number> | undefined) =>
  Object.entries(c ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([nom, v]) => ({ code: nom, nom, v }));

function Courbe({ titre, sousTitre, courbe, unite, tokens }: { titre: string; sousTitre: string; courbe: CourbePrix | undefined; unite: (v: number) => string; tokens: Tokens }) {
  const pts = courbe?.global;
  return (
    <Card title={titre} subtitle={sousTitre}>
      {pts ? (
        <StackedBars xKey="palier" total={false} tokens={tokens} format={(v) => `${fmt.n(v)} %`}
          data={pts.map((p) => ({ palier: unite(p.valeur), chaque: p.chaque * 100, parfois: p.parfois * 100, non: p.non * 100 }))}
          series={[
            { key: "chaque", label: "À chaque fois", color: tokens.s1 },
            { key: "parfois", label: "De temps en temps", color: tokens.s3 },
            { key: "non", label: "Non", color: tokens.axis },
          ]} />
      ) : <Vide>Pas encore assez de réponses pour tracer cette courbe.</Vide>}
    </Card>
  );
}

export function QuestionnaireSynthese({ q, surcoutSP98, prixE85, tokens }: { q: QuestionnaireActif | null; surcoutSP98: number; prixE85: number; tokens: Tokens }) {
  if (!q) return null;
  const sp = q.prix_sp98?.global ? lirePalier(q.prix_sp98.global, surcoutSP98) : null;
  const e = q.prix_e85?.global ? lirePalier(q.prix_e85.global, prixE85) : null;
  const lettres = Object.entries(q.engagement ?? {}).filter(([k]) => k.startsWith("Signer")).reduce((a, [, v]) => a + v, 0);
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi label="Réponses" value={fmt.n(q.reponses)} hint={q.derniere_reponse ? `dernière le ${new Date(q.derniere_reponse).toLocaleDateString("fr-FR")}` : undefined} />
      <Kpi label="Communes couvertes" value={Object.keys(q.par_commune ?? {}).length} hint="sur 24" />
      <Kpi accent={tokens.s1} label="SP98 au surcoût estimé" value={sp ? fmt.pct(sp.chaque) : "—"} hint={`achèteraient à chaque fois à +${fmt.eur(surcoutSP98)}`} />
      <Kpi accent={tokens.s3} label="E85 au prix estimé" value={e ? fmt.pct(e.chaque) : "—"} hint={`rouleraient à l'E85 à chaque fois à ${fmt.eur(prixE85)}`} />
      <Kpi label="Soutiens signés" value={fmt.n(lettres)} hint="pétition ou lettre à la SRPP" />
    </div>
  );
}

export function QuestionnaireDetail({ data, q, tokens }: { data: Dashboard; q: QuestionnaireActif | null; tokens: Tokens }) {
  if (!q) {
    return (
      <Vide>
        Aucune réponse pour le moment. Les résultats du <Link href="/questionnaire" className="underline">questionnaire</Link> s&apos;afficheront ici en direct,
        agrégés (seuil de {data.questionnaire?.disponible ? data.questionnaire.seuil_k : 3} réponses minimum par répartition).
      </Vide>
    );
  }
  const f = (v: number) => fmt.n(v);
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Courbe titre="SP98 : achat selon le surcoût" sousTitre="Part des répondants prêts à payer au moins ce surcoût : particuliers, professionnels (pour leurs clients) et clubs (pour leurs membres)."
          courbe={q.prix_sp98} unite={(v) => `+${fmt.eur(v)}`} tokens={tokens} />
        <Courbe titre="E85 : usage selon le prix à la pompe" sousTitre="Part des répondants prêts à payer au moins ce prix, avec un véhicule compatible. À 1,20 €/L, l'E85 revient à environ 1,50 € pour la distance d'un litre de SP95."
          courbe={q.prix_e85} unite={(v) => fmt.eur(v)} tokens={tokens} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Répondants par public">
          <Ranking data={Object.entries(q.publics ?? {}).map(([k, v]) => ({ code: k, nom: PUBLICS[k as Public], v }))} color={tokens.s1} tokens={tokens} format={f} highlight={null} onPick={() => {}} />
        </Card>
        <Card title="Problèmes constatés faute de SP98"><Ranking data={barres(q.problemes)} color={tokens.s2} tokens={tokens} format={f} highlight={null} onPick={() => {}} /></Card>
        <Card title="Zones demandées pour les premières pompes"><Ranking data={barres(q.zones)} color={tokens.s1} tokens={tokens} format={f} highlight={null} onPick={() => {}} /></Card>
        <Card title="Engagements"><Ranking data={barres(q.engagement)} color={tokens.s3} tokens={tokens} format={f} highlight={null} onPick={() => {}} /></Card>
        <Card title="Notoriété de l'E85"><Ranking data={barres(q.e85?.connaissance)} color={tokens.s3} tokens={tokens} format={f} highlight={null} onPick={() => {}} /></Card>
        <Card title="Budget pour un boîtier E85 (particuliers)"><Ranking data={barres(q.e85?.budget_boitier)} color={tokens.s4} tokens={tokens} format={f} highlight={null} onPick={() => {}} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Stations et distributeurs (${q.stations?.n ?? 0})`} subtitle="Détail masqué sous 3 réponses.">
          {q.stations && q.stations.n >= q.seuil_k ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Volume médian" value={q.stations.volume_m3_median != null ? fmt.m3(q.stations.volume_m3_median) : "—"} hint="d'essence par an" />
                <Kpi label="Investissement accepté" value={q.stations.investissement_median != null ? fmt.euros(q.stations.investissement_median) : "—"} hint="médiane par station" />
                <Kpi label="Marge attendue" value={q.stations.marge_mediane != null ? `${fmt.eur(q.stations.marge_mediane)}/L` : "—"} hint="médiane" />
              </div>
              <Ranking data={barres(q.stations.contraintes)} color={tokens.s2} tokens={tokens} format={f} highlight={null} onPick={() => {}} />
            </div>
          ) : <Vide>Pas encore assez de réponses de stations.</Vide>}
        </Card>
        <Card title={`Filière canne (${q.filiere?.n ?? 0})`} subtitle="Détail masqué sous 3 réponses.">
          {q.filiere && q.filiere.n >= q.seuil_k ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Kpi label="Prix de la paille" value={q.filiere.prix_paille_median != null ? `${fmt.n(q.filiere.prix_paille_median)} €/t` : "—"} hint="médiane, bord de champ" />
                <Kpi label="Prix de la mélasse" value={q.filiere.prix_melasse_median != null ? `${fmt.n(q.filiere.prix_melasse_median)} €/t` : "—"} hint="médiane" />
              </div>
              <Ranking data={barres(q.filiere.roles)} color={tokens.s3} tokens={tokens} format={f} highlight={null} onPick={() => {}} />
            </div>
          ) : <Vide>Pas encore assez de réponses de la filière.</Vide>}
        </Card>
      </div>
    </div>
  );
}
