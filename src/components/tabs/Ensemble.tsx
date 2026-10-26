"use client";

import type { Dashboard } from "@/lib/types";
import { derniereConso, fmt, totalIle, type FiltreStatut } from "@/lib/analysis";
import { Card, Kpi } from "../ui";
import { HighlightLines, StackedArea, StackedBars } from "../charts";
import type { Tokens } from "../useTokens";

export function EnsembleSynthese({ data, tokens }: { data: Dashboard; tokens: Tokens }) {
  const last = data.parc.annees.length - 1;
  const conso = derniereConso(data);
  const essence = totalIle(data, "essence", "tous", last);
  const parc = (["essence", "diesel", "elec", "autre"] as const).reduce((a, f) => a + totalIle(data, f, "tous", last), 0);
  const menages = Object.values(data.communes).reduce((a, c) => a + (c.menages ?? 0), 0);
  const motorises = Object.values(data.communes).reduce((a, c) => a + (c.menages ?? 0) * (c.part_motorises ?? 0), 0);
  const campagne = data.campagnes[data.campagnes.length - 1];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Kpi accent={tokens.s1} label={`VP essence ${data.parc.annees[last]}`} value={fmt.compact(essence)} hint={`${fmt.pct(essence / parc)} du parc VP`} />
      <Kpi accent={tokens.s1} label={`Essence vendue ${conso.annee}`} value={fmt.m3(conso.essence_m3)}
        hint={<span style={{ color: conso.evolution >= 0 ? "var(--good-ink)" : "var(--critical)" }}>{conso.evolution >= 0 ? "▲" : "▼"} {fmt.pct(Math.abs(conso.evolution))} sur un an</span>} />
      <Kpi label="Ménages motorisés" value={fmt.pct(motorises / menages)} hint={`${fmt.n(menages)} ménages (recensement 2023)`} />
      <Kpi label="Stations-service" value={data.stations.length} hint={`BPE ${data.sources.stations.millesime ?? ""} · ${data.stations.filter((x) => x.tmja_proche).length} près d'une RN`} />
      <Kpi accent={tokens.s2} label="Canne déclarée" value={`${fmt.n(data.canne.surface_ha)} ha`} hint={`${fmt.n(data.canne.parcelles)} parcelles (RPG)`} />
      <Kpi accent={tokens.s2} label={`Campagne ${campagne.annee}`} value={`${fmt.n1(campagne.tonnes / 1e6)} Mt`} hint="de cannes broyées (DAAF)" />
    </div>
  );
}

export function EnsembleDetail({ data, statut, tokens }: { data: Dashboard; statut: FiltreStatut; tokens: Tokens }) {
  const parc = data.parc.annees.map((a, i) => ({
    annee: a,
    essence: totalIle(data, "essence", statut, i),
    diesel: totalIle(data, "diesel", statut, i),
    elec: totalIle(data, "elec", statut, i),
  }));
  const immat = data.immat.annees.map((a, i) => ({
    annee: a, essence: data.immat.series.essence[i], diesel: data.immat.series.diesel[i], elec: data.immat.series.elec[i],
  }));
  const drom = Object.keys(data.conso);
  const autres = drom.filter((d) => d !== "La Réunion");
  const consoRows = data.conso["La Réunion"].annees.map((a) => ({
    annee: a, ...Object.fromEntries(drom.map((d) => [d, data.conso[d].essence_m3[data.conso[d].annees.indexOf(a)] ?? 0])),
  }));
  const fuels = [
    { key: "essence", label: "Essence", color: tokens.s1 },
    { key: "diesel", label: "Diesel", color: tokens.s2 },
    { key: "elec", label: "Électrique", color: tokens.s3 },
  ];
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card title="Parc de voitures particulières" subtitle={`Au 1er janvier · ${statut === "tous" ? "tous propriétaires" : statut === "part" ? "particuliers" : "professionnels"}`}>
        <StackedArea data={parc} series={fuels} tokens={tokens} />
      </Card>
      <Card title="Voitures neuves immatriculées" subtitle="Par motorisation et par an : l'essence domine le marché du neuf">
        <StackedBars data={immat} series={fuels} tokens={tokens} />
      </Card>
      <Card title="Essence consommée par DROM" subtitle="En m³ par an : La Réunion est le premier marché d'outre-mer">
        <HighlightLines data={consoRows} focus={{ key: "La Réunion", label: "La Réunion", color: tokens.s1 }} others={autres} tokens={tokens} unit="m³" />
      </Card>
    </div>
  );
}
