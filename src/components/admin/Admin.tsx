"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Public } from "@/lib/types";
import { QUESTIONS, labelDe, type Reponses } from "@/lib/questionnaire/schema";
import { COMMUNES } from "@/lib/questionnaire/communes";
import { fmt } from "@/lib/analysis";
import { Card, Kpi, Vide } from "../ui";
import { Ranking } from "../charts";
import { useTokens } from "../useTokens";
import Markdown from "./Markdown";
import { authClient } from "@/lib/auth-client";

interface Ligne {
  id: string; cree_le: string; public: Public; profil: string; commune_code: string | null; donnees: Reponses; sheet_sync: boolean; contact: boolean;
}
interface Analyse { id: string; cree_le: string; auteur: string; modele: string; nb_reponses: number; resultat: string; filtres: Record<string, string | null> }
interface Fiche { reponse: Ligne; contact: { nom: string | null; structure: string | null; email: string | null; consentement: boolean } | null }

const PUBLICS: Record<Public, string> = { part: "Particulier", pro: "Professionnel", club: "Club", station: "Station / distributeur", filiere: "Filière canne" };
const NOM_COMMUNE = Object.fromEntries(Object.entries(COMMUNES).map(([nom, code]) => [code, nom]));
type Tri = "date" | "public" | "commune";

const afficher = (v: unknown, unite?: string) => {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "number") return unite === "€/L" ? `${fmt.eur(v)}/L` : unite ? `${fmt.n1(v)} ${unite}` : fmt.n1(v);
  return String(v);
};

export default function Admin({ email }: { email: string }) {
  const { tokens } = useTokens();
  const router = useRouter();
  const [filtres, setFiltres] = useState({ public: "", commune: "", du: "", au: "", contact: "" });
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<Tri>("date");
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [analyses, setAnalyses] = useState<Analyse[]>([]);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const query = useMemo(() => new URLSearchParams(Object.entries(filtres).filter(([, v]) => v)).toString(), [filtres]);

  const charger = useCallback(async () => {
    const res = await fetch(`/api/admin/reponses?${query}`, { cache: "no-store" });
    if (res.status === 401) return router.push("/admin/connexion");
    const corps = (await res.json()) as { reponses: Ligne[] };
    setLignes(corps.reponses);
  }, [query, router]);

  useEffect(() => {
    const t = setTimeout(charger, 0);
    return () => clearTimeout(t);
  }, [charger]);
  useEffect(() => {
    fetch("/api/admin/analyse", { cache: "no-store" }).then((r) => r.json()).then((c: { analyses?: Analyse[] }) => setAnalyses(c.analyses ?? [])).catch(() => {});
  }, []);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtrees = (lignes ?? []).filter((l) => !q || `${l.profil} ${NOM_COMMUNE[l.commune_code ?? ""] ?? ""} ${JSON.stringify(l.donnees)}`.toLowerCase().includes(q));
    const cle = (l: Ligne) => (tri === "public" ? l.public : tri === "commune" ? NOM_COMMUNE[l.commune_code ?? ""] ?? "" : "");
    return tri === "date" ? filtrees : [...filtrees].sort((a, b) => cle(a).localeCompare(cle(b), "fr"));
  }, [lignes, recherche, tri]);

  const ouvrir = async (id: string) => {
    const res = await fetch(`/api/admin/reponses/${id}`, { cache: "no-store" });
    if (res.ok) setFiche((await res.json()) as Fiche);
  };

  const supprimer = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette réponse et ses coordonnées ? Cette action est irréversible.")) return;
    const res = await fetch(`/api/admin/reponses/${id}`, { method: "DELETE" });
    setMessage(res.ok ? "Réponse supprimée." : "La suppression a échoué.");
    setFiche(null);
    charger();
  };

  const resynchroniser = async () => {
    const res = await fetch("/api/admin/resync", { method: "POST" });
    const c = (await res.json()) as { a_envoyer?: number; envoyees?: number };
    setMessage(`${c.envoyees ?? 0} réponse(s) copiée(s) dans la Google Sheet sur ${c.a_envoyer ?? 0} en attente.`);
    charger();
  };

  const analyser = async () => {
    setAnalyseEnCours(true);
    setMessage(null);
    const res = await fetch(`/api/admin/analyse?${query}`, { method: "POST" });
    const c = (await res.json()) as { analyse?: Analyse; error?: string };
    if (c.analyse) setAnalyses((a) => [c.analyse!, ...a]);
    else setMessage(c.error ?? "L'analyse a échoué.");
    setAnalyseEnCours(false);
  };

  const deconnecter = async () => {
    await authClient.signOut();
    router.push("/admin/connexion");
  };

  const parPublic = Object.entries(PUBLICS).map(([k, nom]) => ({ code: k, nom, v: (lignes ?? []).filter((l) => l.public === k).length }));
  const champSelect = "rounded-xl border border-line bg-surface px-3 py-2 text-[13px]";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
        <span>Connecté : <strong className="text-ink">{email}</strong></span>
        <button onClick={deconnecter} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:bg-surface-2">Se déconnecter</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Réponses (filtrées)" value={lignes ? fmt.n(lignes.length) : "…"} />
        <Kpi label="Avec coordonnées" value={lignes ? fmt.n(lignes.filter((l) => l.contact).length) : "…"} />
        <Kpi label="Communes" value={lignes ? new Set(lignes.map((l) => l.commune_code)).size : "…"} hint="sur 24" />
        <Kpi label="Non copiées dans la Sheet" value={lignes ? fmt.n(lignes.filter((l) => !l.sheet_sync).length) : "…"}
          hint={<button onClick={resynchroniser} className="underline">Relancer la copie</button>} />
      </div>

      <Card title="Filtres">
        <div className="flex flex-wrap items-end gap-3">
          <select aria-label="Public" className={champSelect} value={filtres.public} onChange={(e) => setFiltres({ ...filtres, public: e.target.value })}>
            <option value="">Tous les publics</option>
            {Object.entries(PUBLICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Commune" className={champSelect} value={filtres.commune} onChange={(e) => setFiltres({ ...filtres, commune: e.target.value })}>
            <option value="">Toutes les communes</option>
            {Object.entries(COMMUNES).map(([nom, code]) => <option key={code} value={code}>{nom}</option>)}
          </select>
          <label className="text-[12px] text-ink-2">Du <input type="date" className={champSelect} value={filtres.du} onChange={(e) => setFiltres({ ...filtres, du: e.target.value })} /></label>
          <label className="text-[12px] text-ink-2">Au <input type="date" className={champSelect} value={filtres.au} onChange={(e) => setFiltres({ ...filtres, au: e.target.value })} /></label>
          <select aria-label="Coordonnées" className={champSelect} value={filtres.contact} onChange={(e) => setFiltres({ ...filtres, contact: e.target.value })}>
            <option value="">Avec ou sans coordonnées</option>
            <option value="oui">Avec coordonnées</option>
            <option value="non">Sans coordonnées</option>
          </select>
          <input type="search" placeholder="Rechercher dans les réponses" value={recherche} onChange={(e) => setRecherche(e.target.value)} className={`${champSelect} min-w-56 flex-1`} />
          <a href={`/api/admin/export?${query}`} className="rounded-xl border border-line px-3 py-2 text-[13px] font-medium hover:bg-surface-2">Export CSV</a>
          <a href={`/api/admin/export?${query}${query ? "&" : ""}contacts=1`} onClick={(e) => { if (!window.confirm("Cet export contient des données personnelles. Le conserver en lieu sûr et le supprimer après usage ?")) e.preventDefault(); }}
            className="rounded-xl border border-line px-3 py-2 text-[13px] font-medium hover:bg-surface-2">Export avec coordonnées</a>
        </div>
      </Card>

      {message && <p className="rounded-xl border border-line bg-surface p-3 text-[13.5px]" role="status">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card title={`Réponses (${visibles.length})`} actions={
          <label className="text-[12.5px] text-ink-2">Trier par{" "}
            <select className={champSelect} value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
              <option value="date">date</option><option value="public">public</option><option value="commune">commune</option>
            </select>
          </label>}>
          {!lignes ? <p className="text-[13px] text-muted">Chargement…</p> : !visibles.length ? <Vide>Aucune réponse avec ces filtres.</Vide> : (
            <div className="max-h-[560px] overflow-auto">
              <table className="tabular w-full text-left text-[13px]">
                <thead className="sticky top-0 bg-surface text-[11.5px] uppercase tracking-wide text-muted">
                  <tr><th className="py-2 pr-3">Date</th><th className="pr-3">Profil</th><th className="pr-3">Commune</th><th className="pr-3 text-right">SP98 max</th><th className="pr-3 text-right">E85 max</th><th className="pr-3">Contact</th><th>Sheet</th></tr>
                </thead>
                <tbody>
                  {visibles.map((l) => (
                    <tr key={l.id} onClick={() => ouvrir(l.id)} className={`cursor-pointer border-t border-line hover:bg-surface-2 ${fiche?.reponse.id === l.id ? "bg-surface-2" : ""}`}>
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.cree_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="pr-3">{l.profil}</td>
                      <td className="pr-3">{NOM_COMMUNE[l.commune_code ?? ""] ?? "—"}</td>
                      <td className="pr-3 text-right">{typeof l.donnees.wtp98_chaque === "number" ? `+${fmt.eur(l.donnees.wtp98_chaque)}` : "—"}</td>
                      <td className="pr-3 text-right">{typeof l.donnees.wtpe85 === "number" ? fmt.eur(l.donnees.wtpe85) : "—"}</td>
                      <td className="pr-3">{l.contact ? "oui" : ""}</td>
                      <td>{l.sheet_sync ? "✓" : "en attente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Répartition par public">
            <Ranking data={parPublic} color={tokens.s1} tokens={tokens} format={fmt.n} highlight={filtres.public || null}
              onPick={(c) => setFiltres({ ...filtres, public: filtres.public === c ? "" : c })} />
          </Card>
          {fiche && (
            <Card title="Fiche de la réponse" subtitle={new Date(fiche.reponse.cree_le).toLocaleString("fr-FR")}
              actions={<button onClick={() => setFiche(null)} className="text-muted hover:text-ink" aria-label="Fermer">✕</button>}>
              <dl className="space-y-2 text-[13px]">
                {QUESTIONS.filter((q) => !q.personnel && fiche.reponse.donnees[q.id] != null).map((q) => (
                  <div key={q.id}>
                    <dt className="text-ink-2">{labelDe(q, fiche.reponse.public)}</dt>
                    <dd className="font-medium">{afficher(fiche.reponse.donnees[q.id], "unite" in q ? q.unite : undefined)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[13px]">
                <div className="mb-1 font-semibold">Coordonnées</div>
                {fiche.contact ? (
                  <p>{fiche.contact.nom ?? "—"} · {fiche.contact.structure ?? "—"} · {fiche.contact.email ? <a className="underline" href={`mailto:${fiche.contact.email}`}>{fiche.contact.email}</a> : "—"}</p>
                ) : <p className="text-ink-2">Réponse anonyme.</p>}
              </div>
              <button onClick={() => supprimer(fiche.reponse.id)} className="mt-4 rounded-xl border border-critical/50 px-3 py-1.5 text-[13px] font-medium text-critical hover:bg-critical/10">
                Supprimer cette réponse (droit à l&apos;effacement)
              </button>
            </Card>
          )}
        </div>
      </div>

      <Card title="Analyse IA" subtitle="Synthèse par Groq des réponses filtrées ci-dessus. Groq ne reçoit ni coordonnées, ni e-mails, numéros ou liens présents dans les textes libres."
        actions={<button onClick={analyser} disabled={analyseEnCours || !lignes?.length} className="rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-plane disabled:opacity-50">
          {analyseEnCours ? "Analyse en cours…" : `Analyser ${lignes ? fmt.n(Math.min(lignes.length, 400)) : ""} réponse(s)`}
        </button>}>
        {!analyses.length ? <Vide>Aucune analyse pour l&apos;instant.</Vide> : (
          <div className="space-y-5">
            {analyses.map((a, k) => (
              <details key={a.id} open={k === 0} className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer text-[13px] text-ink-2">
                  {new Date(a.cree_le).toLocaleString("fr-FR")} · {a.nb_reponses} réponses · {a.modele} · par {a.auteur}
                </summary>
                <div className="mt-3"><Markdown texte={a.resultat} /></div>
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
