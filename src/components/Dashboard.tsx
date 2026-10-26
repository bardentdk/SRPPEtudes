"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Dashboard as Data, Questionnaire } from "@/lib/types";
import {
  INDICATEURS, POIDS_DEFAUT, choisirPilotes, classementImplantation, economieSP98, fmt, questionnaireActif,
  scenarioE85, scenarioSP98, usineEthanol, valeurCommune,
  type FiltreStatut, type Indicateur, type Poids, type SourceDemande,
} from "@/lib/analysis";
import { E85, SP98, USINE, USINE_1G, USINE_2G, defauts, type Valeurs } from "@/lib/hypotheses";
import { RAMPE, seuils, type Couches } from "@/lib/carto";
import { Card, Segmented, Toggle } from "./ui";
import { Ranking } from "./charts";
import RefreshButton from "./RefreshButton";
import Logo from "./Logo";
import { useTokens } from "./useTokens";
import { EnsembleDetail, EnsembleSynthese } from "./tabs/Ensemble";
import { Sp98Detail, Sp98Synthese } from "./tabs/Sp98";
import { E85Filiere, E85Synthese } from "./tabs/E85";
import { UsineDetail } from "./tabs/Usine";
import { ImplantationDetail, ImplantationReglages, type Carburant } from "./tabs/Implantation";
import { QuestionnaireDetail, QuestionnaireSynthese } from "./tabs/Questionnaire";
import { Sources } from "./tabs/Sources";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-[13px] text-muted">Chargement de la carte…</div>,
});

type Onglet = "ensemble" | "implantation" | "sp98" | "e85" | "questionnaire" | "sources";
type AvecCarte = Exclude<Onglet, "sources">;

const ONGLETS: [Onglet, string][] = [
  ["ensemble", "Vue d'ensemble"], ["implantation", "Implantation"], ["sp98", "SP98 importé"], ["e85", "E85 local"],
  ["questionnaire", "Questionnaire"], ["sources", "Données et sources"],
];

const PRESETS: Record<AvecCarte, { indicateur: Indicateur; couches: Couches }> = {
  ensemble: { indicateur: "densite", couches: { communes: true, stations: true, trafic: true, canne: false, sucrerie: false } },
  implantation: { indicateur: "motorisation", couches: { communes: true, stations: true, trafic: true, canne: false, sucrerie: false } },
  sp98: { indicateur: "vp_essence_station", couches: { communes: true, stations: true, trafic: true, canne: false, sucrerie: false } },
  e85: { indicateur: "canne_part", couches: { communes: false, stations: false, trafic: false, canne: true, sucrerie: true } },
  questionnaire: { indicateur: "reponses", couches: { communes: true, stations: false, trafic: false, canne: false, sucrerie: false } },
};

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    // Données publiques du pipeline + agrégats du questionnaire, calculés en direct depuis la base.
    const agregats = fetch("/api/questionnaire/agregats")
      .then((r) => (r.ok ? (r.json() as Promise<Questionnaire>) : { disponible: false as const }))
      .catch(() => ({ disponible: false as const }));
    fetch("/data/dashboard.json")
      .then((r) => (r.ok ? (r.json() as Promise<Data>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(async (d) => setData({ ...d, questionnaire: await agregats }))
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
  const [vueE85, setVueE85] = useState<"filiere" | "usine">("filiere");
  const [indicateur, setIndicateur] = useState<Indicateur>("densite");
  const [couches, setCouches] = useState<Couches>(PRESETS.ensemble.couches);
  const [statut, setStatut] = useState<FiltreStatut>("tous");
  const [anneeIdx, setAnneeIdx] = useState(data.parc.annees.length - 1);
  const [selection, setSelection] = useState<string | null>(null);
  const [hSp98, setHSp98] = useState<Valeurs<typeof SP98>>(defauts(SP98));
  const [hE85, setHE85] = useState<Valeurs<typeof E85>>(defauts(E85));
  const [hU, setHU] = useState<Valeurs<typeof USINE>>(defauts(USINE));
  const [h1, setH1] = useState<Valeurs<typeof USINE_1G>>(defauts(USINE_1G));
  const [h2, setH2] = useState<Valeurs<typeof USINE_2G>>(defauts(USINE_2G));
  const [campagne, setCampagne] = useState(data.campagnes[data.campagnes.length - 1].annee);
  const [source, setSource] = useState<SourceDemande>("questionnaire");
  const [carburant, setCarburant] = useState<Carburant>("sp98");
  const [poids, setPoids] = useState<Record<Carburant, Poids>>(POIDS_DEFAUT);
  const [ecart, setEcart] = useState(3);
  const [siteIdx, setSiteIdx] = useState(0);

  const q = questionnaireActif(data);
  const sites = useMemo(() => data.sucrerie.filter((s) => s.type === "usine"), [data]);
  const site = sites[siteIdx] ?? sites[0];

  const u1 = useMemo(() => usineEthanol(data, hE85, hU, h1, "1G", site, campagne), [data, hE85, hU, h1, site, campagne]);
  const u2 = useMemo(() => usineEthanol(data, hE85, hU, h2, "2G", site, campagne), [data, hE85, hU, h2, site, campagne]);
  // La marge déclarée par les stations remplace l'hypothèse dans tous les calculs SP98.
  const margeDeclaree = source === "questionnaire" ? q?.stations?.marge_mediane ?? null : null;
  const hSp98Eff = useMemo(() => (margeDeclaree != null ? { ...hSp98, margeDistrib: margeDeclaree } : hSp98), [hSp98, margeDeclaree]);
  const sp98 = useMemo(() => scenarioSP98(data, hSp98Eff), [data, hSp98Eff]);
  const eco = useMemo(() => economieSP98(data, hSp98Eff, q, source), [data, hSp98Eff, q, source]);
  const e85 = useMemo(() => {
    const cout = (u: typeof u1) => (Number.isFinite(u.coutRevient) ? u.coutRevient : hU.prixVente);
    return scenarioE85(data, hE85, campagne, hSp98.prixSP95, { g1: cout(u1), g2: cout(u2) }, q, source);
  }, [data, hE85, campagne, hSp98.prixSP95, u1, u2, hU.prixVente, q, source]);
  const classement = useMemo(
    () => classementImplantation(data, poids[carburant], q, carburant === "e85" ? site : null),
    [data, poids, carburant, q, site],
  );
  const pilotes = useMemo(() => choisirPilotes(classement, hSp98.nbPilotes, ecart), [classement, hSp98.nbPilotes, ecart]);

  const valeurs = useMemo(
    () => Object.fromEntries(Object.values(data.communes).map((c) => [c.code, valeurCommune(data, c, indicateur, statut, anneeIdx)])),
    [data, indicateur, statut, anneeIdx],
  );

  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    if (o !== "sources") {
      setIndicateur(PRESETS[o].indicateur);
      setCouches(PRESETS[o].couches);
    }
  };

  const annee = data.parc.annees[anneeIdx];
  const ind = INDICATEURS[indicateur];
  const rang = Object.values(data.communes).map((c) => ({ code: c.code, nom: c.nom, v: valeurs[c.code] })).sort((a, b) => b.v - a.v);
  const s = seuils(Object.values(valeurs));
  const commune = selection ? data.communes[selection] : null;
  const rayon = onglet === "e85" && vueE85 === "usine" && site
    ? { lat: site.lat, lon: site.lon, km: hU.rayon, label: `${site.nom} · ${hU.rayon} km` } : null;
  const formatValeur = (v: number) => (indicateur === "revenu" ? `${fmt.n(v)} €` : Math.abs(v) >= 100 ? fmt.n(v) : fmt.n1(v));

  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-6">
      <header className="sticky top-0 z-[1100] -mx-4 mb-6 border-b border-line bg-plane/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-center gap-3">
            <Logo size={40} className="shrink-0 text-ink" />
            <div>
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Carburants Réunion</h1>
              <p className="text-[12.5px] text-ink-2">SP98 importé et E85 issu de la canne : étude de viabilité sur données officielles</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-muted md:block">Données du {new Date(data.genere_le).toLocaleDateString("fr-FR")}</span>
            <Link href="/questionnaire" className="rounded-xl bg-s1 px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90">Répondre au questionnaire</Link>
            <RefreshButton />
            <ThemeButton dark={dark} />
          </div>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Sections">
          {ONGLETS.map(([k, label]) => (
            <button key={k} onClick={() => changerOnglet(k)} aria-current={onglet === k ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors ${onglet === k ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      {onglet === "ensemble" && <EnsembleSynthese data={data} tokens={tokens} />}
      {onglet === "sp98" && <Sp98Synthese sp98={sp98} eco={eco} h={hSp98Eff} q={q} tokens={tokens} />}
      {onglet === "e85" && (
        <>
          <div className="mb-4">
            <Segmented label="Vue E85" value={vueE85} onChange={setVueE85}
              options={[{ value: "filiere", label: "Filière E85" }, { value: "usine", label: "Unité de production d'éthanol" }]} />
          </div>
          <E85Synthese e85={e85} prixSP95={hSp98.prixSP95} q={q} tokens={tokens} />
        </>
      )}
      {onglet === "questionnaire" && <QuestionnaireSynthese q={q} surcoutSP98={sp98.surcoutTTC} prixE85={e85.prixE85} tokens={tokens} />}

      {onglet !== "sources" && (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card title={onglet === "implantation" ? "Carte et implantation" : "Filtres de la carte"} className="h-fit lg:sticky lg:top-32">
            <div className="space-y-5">
              <label className="block text-[13px]">
                <span className="text-ink-2">Indicateur par commune</span>
                <select value={indicateur} onChange={(e) => setIndicateur(e.target.value as Indicateur)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink">
                  {Object.entries(INDICATEURS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <div>
                <div className="mb-1.5 text-[13px] text-ink-2">Statut du propriétaire (parc)</div>
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
                <Toggle label={onglet === "implantation" || onglet === "sp98" ? "Stations et pompes proposées" : "Stations-service"} checked={couches.stations} onChange={(v) => setCouches({ ...couches, stations: v })} swatch={tokens.s1} />
                <Toggle label={`Trafic RN (${data.tmja.annee})`} checked={couches.trafic} onChange={(v) => setCouches({ ...couches, trafic: v })} swatch={tokens.ink2} />
                <Toggle label="Parcelles de canne" checked={couches.canne} onChange={(v) => setCouches({ ...couches, canne: v })} swatch={tokens.s2} />
                <Toggle label="Usines et balances" checked={couches.sucrerie} onChange={(v) => setCouches({ ...couches, sucrerie: v })} swatch={tokens.s3} />
              </div>
              {onglet === "implantation" && (
                <ImplantationReglages carburant={carburant} setCarburant={setCarburant} poids={poids[carburant]}
                  setPoids={(p) => setPoids({ ...poids, [carburant]: p })} nb={hSp98.nbPilotes} setNb={(n) => setHSp98({ ...hSp98, nbPilotes: n })}
                  ecart={ecart} setEcart={setEcart} q={q} site={site?.nom ?? ""} />
              )}
            </div>
          </Card>

          <div className="min-w-0 space-y-4">
            <Card className="!p-0 overflow-hidden">
              <div className="relative h-[540px]">
                <MapView data={data} valeurs={valeurs} unite={ind.unite} libelle={ind.label} couches={couches} classement={classement}
                  pilotes={pilotes} tokens={tokens} dark={dark} selection={selection} onSelect={setSelection} rayon={rayon} />
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
                      <dt className="text-ink-2">Ménages motorisés</dt><dd>{commune.part_motorises != null ? fmt.pct(commune.part_motorises) : "—"}</dd>
                      <dt className="text-ink-2">Niveau de vie médian</dt><dd>{commune.niveau_vie_median != null ? `${fmt.n(commune.niveau_vie_median)} €` : "—"}</dd>
                      <dt className="text-ink-2">VP essence {annee}</dt><dd>{fmt.n(valeurCommune(data, commune, "vp_essence", statut, anneeIdx))}</dd>
                      <dt className="text-ink-2">Stations</dt><dd>{commune.stations}</dd>
                      <dt className="text-ink-2">Canne</dt><dd>{fmt.n(commune.canne_ha)} ha</dd>
                      {q && <><dt className="text-ink-2">Réponses</dt><dd>{q.par_commune?.[commune.code] ?? 0}</dd></>}
                    </dl>
                  </div>
                )}
              </div>
            </Card>
            {onglet === "implantation" ? (
              <ImplantationDetail pilotes={pilotes} carburant={carburant} tokens={tokens} />
            ) : (
              <Card title={`Classement des communes · ${ind.label}`} subtitle="Cliquez sur une barre ou une commune de la carte pour la mettre en évidence.">
                <Ranking data={rang} color={tokens.s1} tokens={tokens} format={formatValeur} highlight={selection} onPick={(c) => setSelection(c === selection ? null : c)} />
              </Card>
            )}
          </div>
        </div>
      )}

      {onglet === "ensemble" && <EnsembleDetail data={data} statut={statut} tokens={tokens} />}
      {onglet === "sp98" && (
        <Sp98Detail data={data} sp98={sp98} eco={eco} h={hSp98} setH={setHSp98} pilotes={pilotes} source={source} setSource={setSource}
          q={q} tokens={tokens} onImplantation={() => changerOnglet("implantation")} />
      )}
      {onglet === "e85" && vueE85 === "filiere" && (
        <E85Filiere data={data} e85={e85} h={hE85} setH={setHE85} campagne={campagne} setCampagne={setCampagne}
          source={source} setSource={setSource} q={q} tokens={tokens} />
      )}
      {onglet === "e85" && vueE85 === "usine" && (
        <UsineDetail data={data} u1={u1} u2={u2} sites={sites} siteIdx={siteIdx} setSiteIdx={setSiteIdx}
          hU={hU} setHU={setHU} h1={h1} setH1={setH1} h2={h2} setH2={setH2} tokens={tokens} />
      )}
      {onglet === "questionnaire" && <QuestionnaireDetail data={data} q={q} tokens={tokens} />}
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
