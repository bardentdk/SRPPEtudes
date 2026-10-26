"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Dashboard as Data } from "@/lib/types";
import {
  INDICATEURS, choisirPilotes, classementStations, derniereConso, fmt, scenarioE85, scenarioSP98, totalIle, valeurCommune,
  type FiltreStatut, type Indicateur, type PoidsStations,
} from "@/lib/analysis";
import { E85, SP98, defauts, type Hypothese, type Valeurs } from "@/lib/hypotheses";
import { Card, Check, Kpi, Segmented, Slider, Toggle, VerdictBadge } from "./ui";
import { HStack, HighlightLines, Ranking, SimpleBars, StackedArea, StackedBars } from "./charts";
import { RAMPE, seuils, type Couches } from "@/lib/carto";
import RefreshButton from "./RefreshButton";
import { useTokens } from "./useTokens";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[13px] text-muted">Chargement de la carte…</div>,
});

type Onglet = "ensemble" | "sp98" | "e85" | "sources";

const PRESETS: Record<Exclude<Onglet, "sources">, { indicateur: Indicateur; couches: Couches }> = {
  ensemble: { indicateur: "densite", couches: { communes: true, stations: true, trafic: true, canne: false, sucrerie: false } },
  sp98: { indicateur: "vp_essence_station", couches: { communes: true, stations: true, trafic: true, canne: false, sucrerie: false } },
  e85: { indicateur: "canne_part", couches: { communes: false, stations: false, trafic: false, canne: true, sucrerie: true } },
};

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/dashboard.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e: Error) => setErreur(e.message));
  }, []);

  if (erreur) {
    return <p className="m-auto max-w-md p-8 text-center text-ink-2">Données introuvables ({erreur}). Lancez <code>python3 pipeline/run.py</code> pour générer <code>public/data/dashboard.json</code>.</p>;
  }
  if (!data) return <p className="m-auto p-8 text-muted">Chargement des données…</p>;
  return <Vue data={data} />;
}

function Vue({ data }: { data: Data }) {
  const { tokens, dark } = useTokens();
  const [onglet, setOnglet] = useState<Onglet>("ensemble");
  const [indicateur, setIndicateur] = useState<Indicateur>("densite");
  const [couches, setCouches] = useState<Couches>(PRESETS.ensemble.couches);
  const [statut, setStatut] = useState<FiltreStatut>("tous");
  const [anneeIdx, setAnneeIdx] = useState(data.parc.annees.length - 1);
  const [selection, setSelection] = useState<string | null>(null);
  const [hSp98, setHSp98] = useState<Valeurs<typeof SP98>>(defauts(SP98));
  const [hE85, setHE85] = useState<Valeurs<typeof E85>>(defauts(E85));
  const [poids, setPoids] = useState<PoidsStations>({ trafic: 50, demande: 30, densite: 20 });
  const [campagne, setCampagne] = useState(data.campagnes[data.campagnes.length - 1].annee);

  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    if (o !== "sources") {
      setIndicateur(PRESETS[o].indicateur);
      setCouches(PRESETS[o].couches);
    }
  };

  const valeurs = useMemo(
    () => Object.fromEntries(Object.values(data.communes).map((c) => [c.code, valeurCommune(data, c, indicateur, statut, anneeIdx)])),
    [data, indicateur, statut, anneeIdx],
  );
  const classement = useMemo(() => classementStations(data, poids), [data, poids]);
  const pilotes = useMemo(() => choisirPilotes(classement, hSp98.nbPilotes), [classement, hSp98.nbPilotes]);
  const sp98 = useMemo(() => scenarioSP98(data, hSp98), [data, hSp98]);
  const e85 = useMemo(() => scenarioE85(data, hE85, campagne, hSp98.prixSP95), [data, hE85, campagne, hSp98.prixSP95]);

  const conso = derniereConso(data);
  const last = data.parc.annees.length - 1;
  const annee = data.parc.annees[anneeIdx];
  const ind = INDICATEURS[indicateur];
  const rang = Object.values(data.communes)
    .map((c) => ({ code: c.code, nom: c.nom, v: valeurs[c.code] }))
    .sort((a, b) => b.v - a.v);
  const s = seuils(Object.values(valeurs));
  const commune = selection ? data.communes[selection] : null;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-6">
      <header className="sticky top-0 z-[1000] -mx-4 mb-6 border-b border-line bg-plane/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-center gap-3">
            {/* <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-plane">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M3 20h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div> */}
            <div>
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Carburants Réunion</h1>
              <p className="text-[12.5px] text-ink-2">SP98 importé et E85 issu de la canne : étude de viabilité sur données officielles</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-muted md:block">Données du {new Date(data.genere_le).toLocaleDateString("fr-FR")}</span>
            <RefreshButton />
            <ThemeButton dark={dark} />
          </div>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Sections">
          {([["ensemble", "Vue d'ensemble"], ["sp98", "SP98 importé"], ["e85", "E85 local"], ["sources", "Données et sources"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => changerOnglet(k)}
              aria-current={onglet === k ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors ${onglet === k ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {onglet === "ensemble" && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi accent={tokens.s1} label={`VP essence ${data.parc.annees[last]}`} value={fmt.compact(totalIle(data, "essence", "tous", last))}
            hint={`${fmt.pct(totalIle(data, "essence", "tous", last) / (["essence", "diesel", "elec", "autre"] as const).reduce((a, f) => a + totalIle(data, f, "tous", last), 0))} du parc VP`} />
          <Kpi accent={tokens.s1} label={`Essence vendue ${conso.annee}`} value={fmt.m3(conso.essence_m3)}
            hint={<span style={{ color: conso.evolution >= 0 ? "var(--good-ink)" : "var(--critical)" }}>{conso.evolution >= 0 ? "▲" : "▼"} {fmt.pct(Math.abs(conso.evolution))} sur un an</span>} />
          <Kpi label="Stations-service" value={data.stations.length} hint={`BPE ${data.sources.stations.millesime ?? ""} · ${data.stations.filter((x) => x.tmja_proche).length} à moins de 500 m d'une RN`} />
          <Kpi accent={tokens.s2} label="Canne déclarée" value={`${fmt.n(data.canne.surface_ha)} ha`} hint={`${fmt.n(data.canne.parcelles)} parcelles (RPG)`} />
          <Kpi accent={tokens.s2} label={`Campagne ${data.campagnes.at(-1)!.annee}`} value={`${fmt.n1(data.campagnes.at(-1)!.tonnes / 1e6)} Mt`} hint="de cannes broyées (DAAF)" />
        </div>
      )}

      {onglet === "sp98" && <Sp98Synthese sp98={sp98} h={hSp98} />}
      {onglet === "e85" && <E85Synthese e85={e85} prixSP95={hSp98.prixSP95} />}

      {onglet !== "sources" && (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card title="Filtres de la carte" className="h-fit lg:sticky lg:top-32">
            <div className="space-y-5">
              <label className="block text-[13px]">
                <span className="text-ink-2">Indicateur par commune</span>
                <select value={indicateur} onChange={(e) => setIndicateur(e.target.value as Indicateur)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink">
                  {Object.entries(INDICATEURS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <div>
                <div className="mb-1.5 text-[13px] text-ink-2">Statut du propriétaire</div>
                <Segmented label="Statut" value={statut} onChange={setStatut}
                  options={[{ value: "tous", label: "Tous" }, { value: "part", label: "Particuliers" }, { value: "pro", label: "Pros" }]} />
              </div>
              <label className="block">
                <div className="flex justify-between text-[13px]"><span className="text-ink-2">Année du parc</span><span className="tabular font-semibold">{annee}</span></div>
                <input type="range" min={0} max={data.parc.annees.length - 1} value={anneeIdx} onChange={(e) => setAnneeIdx(Number(e.target.value))} className="mt-1.5 w-full" />
              </label>
              <div>
                <div className="mb-1 text-[13px] text-ink-2">Couches</div>
                <Toggle label="Communes (indicateur)" checked={couches.communes} onChange={(v) => setCouches({ ...couches, communes: v })} swatch={RAMPE[3]} />
                <Toggle label="Stations-service" checked={couches.stations} onChange={(v) => setCouches({ ...couches, stations: v })} swatch={tokens.s1} />
                <Toggle label={`Trafic RN (${data.tmja.annee})`} checked={couches.trafic} onChange={(v) => setCouches({ ...couches, trafic: v })} swatch={tokens.ink2} />
                <Toggle label="Parcelles de canne" checked={couches.canne} onChange={(v) => setCouches({ ...couches, canne: v })} swatch={tokens.s2} />
                <Toggle label="Usines et balances" checked={couches.sucrerie} onChange={(v) => setCouches({ ...couches, sucrerie: v })} swatch={tokens.s3} />
              </div>
              {onglet === "sp98" && (
                <div className="space-y-3 border-t border-line pt-4">
                  <div className="text-[13px] font-medium">Pondération des stations pilotes</div>
                  {(["trafic", "demande", "densite"] as const).map((k) => (
                    <Slider key={k} value={poids[k]} onChange={(v) => setPoids({ ...poids, [k]: v })}
                      h={{ label: { trafic: "Trafic RN à proximité", demande: "VP essence par station", densite: "Densité de population" }[k], unite: "", defaut: 0, min: 0, max: 100, pas: 5, note: "" }}
                      format={(v) => `${v}`} />
                  ))}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="!p-0 overflow-hidden">
              <div className="relative h-[520px]">
                <MapView data={data} valeurs={valeurs} unite={ind.unite} libelle={ind.label} couches={couches} classement={classement}
                  pilotes={pilotes} tokens={tokens} dark={dark} selection={selection} onSelect={setSelection} />
                {couches.communes && (
                  <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl border border-line bg-surface/95 p-3 text-[11.5px] shadow-sm backdrop-blur">
                    <div className="mb-1.5 font-semibold">{ind.label} <span className="font-normal text-muted">({ind.unite})</span></div>
                    <div className="flex">
                      {RAMPE.map((c) => <span key={c} className="h-2.5 w-9 first:rounded-l last:rounded-r" style={{ background: c }} />)}
                    </div>
                    <div className="tabular mt-1 flex justify-between text-muted"><span>{fmt.compact(rang.at(-1)!.v)}</span><span>{fmt.compact(s[2])}</span><span>{fmt.compact(rang[0].v)}</span></div>
                  </div>
                )}
                {commune && (
                  <div className="absolute right-3 top-3 z-[500] w-64 rounded-xl border border-line bg-surface/95 p-4 text-[12.5px] shadow-lg backdrop-blur">
                    <div className="flex items-start justify-between">
                      <div className="text-[14px] font-semibold">{commune.nom}</div>
                      <button onClick={() => setSelection(null)} className="text-muted hover:text-ink" aria-label="Fermer">✕</button>
                    </div>
                    <dl className="tabular mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                      <dt className="text-ink-2">Population</dt><dd>{fmt.n(commune.population)}</dd>
                      <dt className="text-ink-2">Densité</dt><dd>{fmt.n(commune.densite)} hab./km²</dd>
                      <dt className="text-ink-2">VP essence {annee}</dt><dd>{fmt.n(valeurCommune(data, commune, "vp_essence", statut, anneeIdx))}</dd>
                      <dt className="text-ink-2">Part essence</dt><dd>{fmt.n1(valeurCommune(data, commune, "part_essence", statut, anneeIdx))} %</dd>
                      <dt className="text-ink-2">Stations</dt><dd>{commune.stations}</dd>
                      <dt className="text-ink-2">Motos neuves (10 ans)</dt><dd>{fmt.n(commune.motos_10ans)}</dd>
                      <dt className="text-ink-2">Canne</dt><dd>{fmt.n(commune.canne_ha)} ha</dd>
                    </dl>
                  </div>
                )}
              </div>
            </Card>
            <Card title={`Classement des communes · ${ind.label}`} subtitle="Cliquez sur une barre ou une commune de la carte pour la mettre en évidence.">
              <Ranking data={rang} color={tokens.s1} tokens={tokens} format={(v) => (Math.abs(v) >= 100 ? fmt.n(v) : fmt.n1(v))} highlight={selection} onPick={(c) => setSelection(c === selection ? null : c)} />
            </Card>
          </div>
        </div>
      )}

      {onglet === "ensemble" && <Ensemble data={data} statut={statut} />}
      {onglet === "sp98" && <Sp98Detail data={data} sp98={sp98} h={hSp98} setH={setHSp98} pilotes={pilotes} />}
      {onglet === "e85" && <E85Detail data={data} e85={e85} h={hE85} setH={setHE85} campagne={campagne} setCampagne={setCampagne} />}
      {onglet === "sources" && <Sources data={data} />}
    </div>
  );
}

function ThemeButton({ dark }: { dark: boolean }) {
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme");
      if (t) document.documentElement.dataset.theme = t;
    } catch {}
  }, []);
  const basculer = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button onClick={basculer} className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-ink-2 hover:text-ink" aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}>
      {dark ? "☀" : "☾"}
    </button>
  );
}

function Hypotheses<T extends Record<string, Hypothese>>({ defs, valeurs, set, cles }: {
  defs: T; valeurs: Valeurs<T>; set: (v: Valeurs<T>) => void; cles: (keyof T)[];
}) {
  return (
    <div className="space-y-4">
      {cles.map((k) => (
        <Slider key={String(k)} h={defs[k]} value={valeurs[k]} onChange={(v) => set({ ...valeurs, [k]: v })} />
      ))}
    </div>
  );
}

// --- Vue d'ensemble ----------------------------------------------------------------

function Ensemble({ data, statut }: { data: Data; statut: FiltreStatut }) {
  const { tokens } = useTokens();
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

// --- SP98 ------------------------------------------------------------------------------

type ScenarioSP98 = ReturnType<typeof scenarioSP98>;
type ScenarioE85 = ReturnType<typeof scenarioE85>;

function Sp98Synthese({ sp98, h }: { sp98: ScenarioSP98; h: Valeurs<typeof SP98> }) {
  const { tokens } = useTokens();
  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Verdict du scénario</div>
          <VerdictBadge verdict={sp98.verdict} large />
        </div>
        <ul className="mt-4 space-y-2">
          <Check ok={sp98.prixOk}>Surcoût à la pompe de <strong>{fmt.eur(sp98.surcoutTTC)}</strong> pour un maximum acceptable de {fmt.eur(h.primeAcceptable)}</Check>
          <Check ok={sp98.stationsOk}><strong>{fmt.m3(sp98.volParStation)}</strong> par pompe pilote pour un minimum de {fmt.m3(h.volMinStation)}</Check>
        </ul>
      </div>
      <Kpi accent={tokens.s1} label="Prix SP98 estimé" value={fmt.eur(sp98.prixSP98)} hint={`pour un SP95 à ${fmt.eur(h.prixSP95)}`} />
      <Kpi accent={tokens.s1} label="Volume retenu" value={fmt.m3(sp98.volume)} hint={`${fmt.pct(sp98.volume / sp98.conso.essence_m3)} de l'essence vendue en ${sp98.conso.annee}`} />
      <Kpi label="Seuil de rentabilité" value={fmt.m3(sp98.seuil)} hint={Number.isFinite(sp98.seuil) ? `${sp98.volume >= sp98.seuil ? "atteint" : `manque ${fmt.m3(sp98.seuil - sp98.volume)}`}` : "inatteignable avec ces coûts"} />
    </div>
  );
}

function Sp98Detail({ data, sp98, h, setH, pilotes }: {
  data: Data; sp98: ScenarioSP98; h: Valeurs<typeof SP98>; setH: (v: Valeurs<typeof SP98>) => void; pilotes: ReturnType<typeof classementStations>;
}) {
  const { tokens } = useTokens();
  const d = sp98.decomposition;
  const prix = [
    { nom: "SP95", base: h.prixSP95, produit: 0, logistique: 0, marge: 0, tva: 0 },
    { nom: "SP98 estimé", base: h.prixSP95, produit: d.produit, logistique: Math.min(d.logistique, 2), marge: d.marge, tva: d.tva },
  ];
  const volumes = [
    { nom: "Par la conso", descendant: sp98.volDescendant, vp: 0, motos: 0 },
    { nom: "Par le parc", descendant: 0, vp: sp98.volVp, motos: sp98.volMotos },
  ];
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Hypothèses du scénario" subtitle="Ordres de grandeur à confirmer : survolez une ligne pour sa justification.">
        <Hypotheses defs={SP98} valeurs={h} set={setH} cles={Object.keys(SP98) as (keyof typeof SP98)[]} />
      </Card>
      <div className="space-y-4">
        <Card title="Formation du prix à la pompe" subtitle="Le coût fixe de la filière dédiée est réparti sur le volume vendu : c'est lui qui fait ou défait le projet.">
          <HStack data={prix} tokens={tokens} format={fmt.eur} series={[
            { key: "base", label: "Prix SP95", color: tokens.axis },
            { key: "produit", label: "Produit et fret", color: tokens.s1 },
            { key: "logistique", label: "Logistique dédiée", color: tokens.s2 },
            { key: "marge", label: "Marge distributeur", color: tokens.s3 },
            { key: "tva", label: "TVA 8,5 %", color: tokens.s4 },
          ]} />
        </Card>
        <Card title="Volume de SP98 : deux estimations croisées" subtitle="Le volume retenu est le plus faible des deux (approche prudente).">
          <HStack data={volumes} tokens={tokens} format={fmt.m3} series={[
            { key: "descendant", label: `${fmt.n1(h.captation)} % de l'essence vendue`, color: tokens.s1 },
            { key: "vp", label: "VP où le 98 est préconisé", color: tokens.s2 },
            { key: "motos", label: `Motos neuves ${data.immat.periode_motos}`, color: tokens.s3 },
          ]} />
          <p className="mt-3 text-[12.5px] text-ink-2">
            Base : {fmt.n(sp98.conso.essence_m3)} m³ d&apos;essence vendus en {sp98.conso.annee} (SDES), {fmt.n(sp98.vpEssencePart)} VP essence de particuliers et {fmt.n(sp98.motos)} motos neuves immatriculées sur 10 ans.
          </p>
        </Card>
        <Card title={`Stations pilotes proposées (${pilotes.length})`} subtitle="Score sur 100 selon le trafic RN à moins de 500 m, la demande essence par station de la commune et la densité, avec au moins 3 km entre deux pilotes. Réglez les poids dans les filtres de la carte.">
          <div className="overflow-x-auto">
            <table className="tabular w-full text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-3">#</th><th className="pr-3">Commune</th><th className="pr-3 text-right">Trafic RN</th><th className="pr-3 text-right">Distance RN</th><th className="text-right">Score</th></tr>
              </thead>
              <tbody>
                {pilotes.map((st, i) => (
                  <tr key={st.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold">{i + 1}</td>
                    <td className="pr-3">{st.nom}</td>
                    <td className="pr-3 text-right">{st.tmja_proche ? `${fmt.n(st.tmja_proche)} véh./j` : "—"}</td>
                    <td className="pr-3 text-right">{st.dist_rn_km < 1 ? `${fmt.n(st.dist_rn_km * 1000)} m` : `${fmt.n1(st.dist_rn_km)} km`}</td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-s1" style={{ width: `${st.score}%` }} /></span>
                        <strong>{st.score}</strong>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-muted">Les noms et enseignes des stations ne figurent pas dans la BPE ; la position exacte s&apos;affiche au survol sur la carte.</p>
        </Card>
      </div>
    </div>
  );
}

// --- E85 -------------------------------------------------------------------------------

function E85Synthese({ e85, prixSP95 }: { e85: ScenarioE85; prixSP95: number }) {
  const { tokens } = useTokens();
  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">Verdict du scénario</div>
          <VerdictBadge verdict={e85.verdict} large />
        </div>
        <ul className="mt-4 space-y-2">
          <Check ok={e85.prixOk}>À distance égale, l&apos;E85 coûte <strong>{fmt.eur(e85.prixEquivalent)}</strong> contre {fmt.eur(prixSP95)} pour le SP95</Check>
          <Check ok={e85.ressourceOk}>L&apos;offre locale couvre <strong>{fmt.pct(e85.couverture)}</strong> de la demande flex-fuel</Check>
          <Check ok={e85.electriciteOk}>{e85.electriciteOk ? "Aucune bagasse retirée aux centrales électriques" : <><strong>{fmt.n(e85.electricitePerdue)} MWh</strong> d&apos;électricité perdus (bagasse détournée)</>}</Check>
        </ul>
      </div>
      <Kpi accent={tokens.s3} label="Éthanol mobilisable" value={`${fmt.n(e85.ethanol / 1000)} m³`} hint={`campagne ${e85.campagne.annee} · ${fmt.n1(e85.campagne.tonnes / 1e6)} Mt de canne`} />
      <Kpi accent={tokens.s3} label="Prix E85 estimé" value={fmt.eur(e85.prixE85)} hint={`coût éthanol moyen ${fmt.eur(e85.coutEthanol)}/L`} />
      <Kpi accent={tokens.s3} label="Essence importée évitée" value={fmt.m3(e85.essenceEvitee)} hint={`${fmt.pct(e85.partEssenceEvitee)} de la consommation de l'île`} />
    </div>
  );
}

function E85Detail({ data, e85, h, setH, campagne, setCampagne }: {
  data: Data; e85: ScenarioE85; h: Valeurs<typeof E85>; setH: (v: Valeurs<typeof E85>) => void; campagne: number; setCampagne: (a: number) => void;
}) {
  const { tokens } = useTokens();
  const enE85m3 = (litresEthanol: number) => litresEthanol / (h.partEthanolE85 / 100) / 1000;
  const bilan = [
    { nom: "Offre locale", melasse: enE85m3(e85.ethMelasse), paille: enE85m3(e85.ethPaille), bagasse: enE85m3(e85.ethBagasse), demande: 0 },
    { nom: "Demande", melasse: 0, paille: 0, bagasse: 0, demande: e85.demandeE85 / 1000 },
  ];
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Hypothèses de la filière" subtitle="Rendements et parts mobilisables : survolez une ligne pour sa justification.">
        <div className="mb-5">
          <div className="mb-1.5 text-[13px] text-ink-2">Campagne sucrière de référence</div>
          <Segmented label="Campagne" value={String(campagne)} onChange={(v) => setCampagne(Number(v))}
            options={data.campagnes.map((c) => ({ value: String(c.annee), label: String(c.annee) }))} />
        </div>
        <Hypotheses defs={E85} valeurs={h} set={setH} cles={Object.keys(E85) as (keyof typeof E85)[]} />
      </Card>
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-5 text-[13.5px] leading-relaxed">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] text-white" style={{ background: "var(--warning)" }} aria-hidden>!</span>
            La canne n&apos;est pas un déchet aujourd&apos;hui
          </div>
          <p className="text-ink-2">
            La <strong>bagasse</strong> alimente les centrales de Bois-Rouge et du Gol, et la <strong>mélasse</strong> les distilleries de rhum.
            La ressource réellement libre est la <strong>paille</strong> laissée au champ, qui demande un éthanol de 2e génération, plus coûteux.
            Chaque tonne de bagasse détournée retire environ {fmt.n1(h.mwhParTBagasse)} MWh au réseau électrique de l&apos;île.
          </p>
        </div>
        <Card title="E85 : offre locale face à la demande" subtitle={`En m³ d'E85 par an. Demande : ${fmt.n(e85.vpFlex)} VP flex-fuel (${fmt.n1(h.partFlex)} % des VP essence), surconsommation incluse.`}>
          <HStack data={bilan} tokens={tokens} format={(v) => `${fmt.n(v)} m³`} series={[
            { key: "melasse", label: "Mélasse (1G)", color: tokens.s3 },
            { key: "paille", label: "Paille (2G)", color: tokens.s4 },
            { key: "bagasse", label: "Bagasse détournée (2G)", color: tokens.s2 },
            { key: "demande", label: "Demande flex-fuel", color: tokens.s1 },
          ]} />
          <p className="mt-3 text-[12.5px] text-ink-2">
            L&apos;E85 vendu remplacerait <strong>{fmt.m3(e85.essenceEvitee)}</strong> d&apos;essence importée, soit {fmt.pct(e85.partEssenceEvitee)} de la consommation de l&apos;île.
          </p>
        </Card>
        <Card title="Tonnages des campagnes sucrières" subtitle="Tonnes de cannes broyées par les deux usines (DAAF). La ressource baisse : 2024 est la plus faible campagne de l'histoire moderne.">
          <SimpleBars data={data.campagnes.map((c) => ({ annee: c.annee, v: c.tonnes }))} color={tokens.s2} tokens={tokens} format={(v) => `${fmt.n(v)} t`} />
        </Card>
      </div>
    </div>
  );
}

// --- Sources ----------------------------------------------------------------------------

function Sources({ data }: { data: Data }) {
  const communes = Object.values(data.communes).sort((a, b) => b.population - a.population);
  const last = data.parc.annees.length - 1;
  const prixSP = data.prix.filter((p) => p.produit === "SP95").at(-1);
  return (
    <div className="space-y-4">
      <Card title="Sources officielles" subtitle="Récupérées automatiquement par pipeline/run.py, sauf les deux saisies manuelles publiées uniquement en PDF.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11.5px] uppercase tracking-wide text-muted">
              <tr><th className="py-2 pr-4">Donnée</th><th className="pr-4">Producteur</th><th className="pr-4">Millésime</th><th className="pr-4 text-right">Lignes</th><th className="pr-4">Récupérée le</th><th>Licence</th></tr>
            </thead>
            <tbody>
              {Object.entries(data.sources).map(([k, src]) => (
                <tr key={k} className="border-t border-line align-top">
                  <td className="py-2.5 pr-4"><a href={src.page} target="_blank" rel="noreferrer" className="font-medium underline decoration-line underline-offset-2 hover:decoration-ink">{src.label}</a></td>
                  <td className="pr-4 text-ink-2">{src.producer}</td>
                  <td className="tabular pr-4">{src.millesime ?? "—"}</td>
                  <td className="tabular pr-4 text-right">{fmt.n(src.lignes)}</td>
                  <td className="tabular pr-4 text-ink-2">{src.recupere_le ? new Date(src.recupere_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "saisie manuelle"}</td>
                  <td className="text-ink-2">{src.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prixSP && (
          <p className="mt-3 text-[12.5px] text-ink-2">
            Dernier prix SP95 relevé : <strong>{fmt.eur(prixSP.prix)}</strong> ({prixSP.mois}, {prixSP.source}{prixSP.verifie ? "" : ", à vérifier sur l'arrêté"}). À mettre à jour dans <code>pipeline/manual/prix_prefecture.csv</code>.
          </p>
        )}
      </Card>
      <Card title="Données par commune" subtitle={`Vue tabulaire de la carte · parc au 1er janvier ${data.parc.annees[last]}`}>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-right text-[13px]">
            <thead className="text-[11.5px] uppercase tracking-wide text-muted">
              <tr><th className="py-2 pr-3 text-left">Commune</th><th className="pr-3">Population</th><th className="pr-3">Densité</th><th className="pr-3">VP essence</th><th className="pr-3">Part essence</th><th className="pr-3">Stations</th><th className="pr-3">Motos 10 ans</th><th>Canne (ha)</th></tr>
            </thead>
            <tbody>
              {communes.map((c) => (
                <tr key={c.code} className="border-t border-line">
                  <td className="py-2 pr-3 text-left font-medium">{c.nom}</td>
                  <td className="pr-3">{fmt.n(c.population)}</td>
                  <td className="pr-3">{fmt.n(c.densite)}</td>
                  <td className="pr-3">{fmt.n(valeurCommune(data, c, "vp_essence", "tous", last))}</td>
                  <td className="pr-3">{fmt.n1(valeurCommune(data, c, "part_essence", "tous", last))} %</td>
                  <td className="pr-3">{c.stations}</td>
                  <td className="pr-3">{fmt.n(c.motos_10ans)}</td>
                  <td>{fmt.n(c.canne_ha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Méthode et limites">
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>Aucune source publique ne donne le nombre de véhicules pour lesquels le constructeur préconise le 98 : c&apos;est l&apos;hypothèse la plus sensible, à remplacer par le comptage des concessionnaires.</li>
          <li>Les stations viennent de la BPE {data.sources.stations.millesime} (INSEE) : position fiable, mais sans enseigne ni volumes vendus.</li>
          <li>Le trafic est celui des routes nationales seulement ({data.tmja.annee}) ; les routes départementales ne sont pas couvertes.</li>
          <li>La surface en canne vient des déclarations PAC (RPG) : elle sous-estime légèrement la sole cannière totale.</li>
          <li>Les coûts (logistique, production d&apos;éthanol, taxes) sont des ordres de grandeur ; seules la SRPP, les distributeurs et la filière peuvent les préciser.</li>
        </ul>
      </Card>
    </div>
  );
}
