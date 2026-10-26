"use client";

import { useState } from "react";
import { supabaseNavigateur } from "@/lib/supabase/navigateur";

export default function Connexion() {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "envoye">("saisie");
  const erreurLien = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("erreur") === "lien";

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEtat("envoi");
    // Même message quel que soit le résultat : on ne révèle pas quelles adresses sont admin.
    await supabaseNavigateur().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin/auth/callback`, shouldCreateUser: false },
    });
    setEtat("envoye");
  };

  if (etat === "envoye") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-[14px] text-ink-2">
        Si cette adresse est autorisée, un lien de connexion vient d&apos;y être envoyé. Il est valable une heure.
      </div>
    );
  }
  return (
    <form onSubmit={envoyer} className="max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6">
      {erreurLien && <p className="text-[13px] text-critical" role="alert">Ce lien est invalide ou a expiré. Demandez-en un nouveau.</p>}
      <label className="block text-[14px]">
        <span className="font-medium">Adresse e-mail</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px]" />
      </label>
      <button type="submit" disabled={etat === "envoi"} className="w-full rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-plane disabled:opacity-50">
        {etat === "envoi" ? "Envoi…" : "Recevoir le lien de connexion"}
      </button>
    </form>
  );
}
