"use client";

import { useCallback, useEffect, useState } from "react";

type Run = { status: string; conclusion: string | null; created_at: string; html_url: string };
type Etat = { configured: boolean; run?: Run | null };

const POLL_MS = 15000;

export default function RefreshButton() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/refresh", { cache: "no-store" });
      setEtat((await res.json()) as Etat);
    } catch {
      setEtat({ configured: false });
    }
  }, []);

  const enCours = !!etat?.run && etat.run.status !== "completed";

  useEffect(() => {
    // première lecture de l'état du workflow, puis suivi tant qu'une actualisation tourne
    const first = setTimeout(charger, 0);
    if (!enCours) return () => clearTimeout(first);
    const id = setInterval(charger, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [enCours, charger]);

  const lancer = async () => {
    setMessage(null);
    const res = await fetch("/api/refresh", { method: "POST" });
    const body = (await res.json()) as { error?: string };
    setMessage(res.ok ? "Actualisation lancée : environ 3 minutes, puis redéploiement automatique." : body.error ?? "Échec.");
    setTimeout(charger, 4000);
  };

  const indisponible = etat !== null && !etat.configured;
  const titre = indisponible
    ? "Disponible une fois déployé sur Vercel avec GITHUB_TOKEN et GITHUB_REPOSITORY. En local : python3 pipeline/run.py --force"
    : etat?.run
      ? `Dernière actualisation : ${new Date(etat.run.created_at).toLocaleString("fr-FR")} (${etat.run.conclusion ?? etat.run.status})`
      : "Relancer la collecte des données officielles";

  return (
    <div className="flex items-center gap-3">
      {message && <span className="hidden max-w-64 text-[12px] text-ink-2 lg:block" role="status">{message}</span>}
      <button
        onClick={lancer}
        disabled={indisponible || enCours || etat === null}
        title={titre}
        className="inline-flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2 text-[13px] font-medium text-plane transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${enCours ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {enCours ? "Actualisation…" : "Actualiser les données"}
      </button>
    </div>
  );
}
