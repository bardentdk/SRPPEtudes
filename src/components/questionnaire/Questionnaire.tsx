"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ID_PERSONNELS, etapesVisibles, publicDe, questionsVisibles, valider, type Reponses, type Valeur } from "@/lib/questionnaire/schema";
import { NOMS_COMMUNES } from "@/lib/questionnaire/communes";
import { Champ } from "./Champ";
import { Alerte } from "../ui";

const BROUILLON = "questionnaire-brouillon-v1";

export default function Questionnaire() {
  const [reponses, setReponses] = useState<Reponses>({});
  const [index, setIndex] = useState(0);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [debut, setDebut] = useState(0);
  const [piege, setPiege] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "merci">("saisie");
  const [message, setMessage] = useState<string | null>(null);

  // Brouillon local (sans les coordonnées), repris si la page est rechargée.
  useEffect(() => {
    let brouillon: { reponses?: Reponses; index?: number } = {};
    try {
      brouillon = JSON.parse(localStorage.getItem(BROUILLON) ?? "{}");
    } catch {}
    const t = setTimeout(() => {
      if (brouillon.reponses) setReponses(brouillon.reponses);
      if (brouillon.index) setIndex(brouillon.index);
      setDebut(Date.now());
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (etat !== "saisie") return;
    const sansPerso = Object.fromEntries(Object.entries(reponses).filter(([k]) => !ID_PERSONNELS.includes(k)));
    try {
      localStorage.setItem(BROUILLON, JSON.stringify({ reponses: sansPerso, index }));
    } catch {}
  }, [reponses, index, etat]);

  const pub = publicDe(reponses);
  const etapes = etapesVisibles(reponses);
  const i = Math.min(index, etapes.length - 1);
  const etape = etapes[i];
  const questions = questionsVisibles(reponses, etape.id);
  const derniere = i === etapes.length - 1;

  // Les curseurs obligatoires partent de leur valeur par défaut, affichée à l'écran.
  const valeursAffichees: Reponses = { ...reponses };
  for (const q of questions) if (q.type === "curseur" && valeursAffichees[q.id] == null) valeursAffichees[q.id] = q.defaut;

  const changer = (id: string, v: Valeur) => {
    setReponses((r) => ({ ...valeursAffichees, ...r, [id]: v }));
    setErreurs((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== id)));
  };

  const suivant = async () => {
    const courantes = { ...reponses, ...valeursAffichees };
    setReponses(courantes);
    const errs = valider(courantes, NOMS_COMMUNES, etape.id);
    setErreurs(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`q-${Object.keys(errs)[0]}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (!derniere) {
      setIndex(i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setEtat("envoi");
    setMessage(null);
    const res = await fetch("/api/reponses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reponses: courantes, debut, site_web: piege }),
    }).catch(() => null);
    if (res?.ok) {
      try {
        localStorage.removeItem(BROUILLON);
      } catch {}
      setEtat("merci");
      window.scrollTo({ top: 0 });
      return;
    }
    const corps = (await res?.json().catch(() => null)) as { error?: string; erreurs?: Record<string, string> } | null;
    if (corps?.erreurs) setErreurs(corps.erreurs);
    setMessage(corps?.error ?? "L'envoi a échoué. Vérifiez votre connexion et réessayez.");
    setEtat("saisie");
  };

  if (etat === "merci") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-good text-[22px] text-white" aria-hidden>✓</div>
        <h2 className="text-[20px] font-semibold tracking-tight">Merci pour votre participation</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-2">
          Vos réponses rejoignent l&apos;étude. Les résultats agrégés sont visibles dans le tableau de bord, et seront partagés avec les acteurs de la filière.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-plane">Voir le tableau de bord</Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); suivant(); }} noValidate>
      <ol className="mb-6 flex gap-1.5" aria-label="Progression">
        {etapes.map((e, k) => (
          <li key={e.id} className="flex-1">
            <div className={`h-1.5 rounded-full ${k <= i ? "bg-s1" : "bg-surface-2"}`} />
            <div className={`mt-1.5 hidden text-[11.5px] sm:block ${k === i ? "font-semibold text-ink" : "text-muted"}`}>{e.titre}</div>
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <h2 className="text-[19px] font-semibold tracking-tight">{etape.titre}</h2>
        <p className="mt-1 text-[13px] text-muted">Étape {i + 1} sur {etapes.length}{pub ? "" : " · les questions suivantes s'adaptent à votre profil"}</p>
        {etape.id === "coordonnees" && (
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-[13px] text-ink-2">
            Facultatif. Laissez vide pour rester anonyme. Vos coordonnées ne servent qu&apos;à vous recontacter au sujet de l&apos;étude :
            elles ne sont jamais publiées, ni transmises, ni envoyées à l&apos;outil d&apos;analyse. <Link href="/confidentialite" className="underline">En savoir plus</Link>.
          </p>
        )}
        <div className="mt-6 space-y-8">
          {questions.map((q) => (
            <Champ key={q.id} q={q} pub={pub} valeur={valeursAffichees[q.id]} erreur={erreurs[q.id]} onChange={(v) => changer(q.id, v)} />
          ))}
        </div>
        {/* Champ piège : invisible pour un humain, rempli par les robots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Site web <input tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} /></label>
        </div>
      </section>

      {message && <div className="mt-4"><Alerte ton="erreur" onFermer={() => setMessage(null)}>{message}</Alerte></div>}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => { setIndex(Math.max(0, i - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={i === 0}
          className="rounded-xl border border-line px-4 py-2.5 text-[14px] font-medium disabled:opacity-40">Retour</button>
        <button type="submit" disabled={etat === "envoi"}
          className="rounded-xl bg-ink px-5 py-2.5 text-[14px] font-medium text-plane disabled:opacity-50">
          {derniere ? (etat === "envoi" ? "Envoi…" : "Envoyer mes réponses") : "Continuer"}
        </button>
      </div>
    </form>
  );
}
