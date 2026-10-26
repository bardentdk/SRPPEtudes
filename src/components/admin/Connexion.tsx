"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Alerte } from "../ui";

export default function Connexion() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const connecter = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const { error } = await authClient.signIn.email({ email, password: motDePasse });
    setEnvoi(false);
    if (!error) return router.push("/admin");
    // Message volontairement générique : on ne révèle pas si l'adresse existe.
    setErreur(error.status === 429 ? "Trop de tentatives. Réessayez dans quelques minutes." : "Adresse ou mot de passe incorrect.");
  };

  return (
    <form onSubmit={connecter} className="max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6">
      <label className="block text-[14px]">
        <span className="font-medium">Adresse e-mail</span>
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px]" />
      </label>
      <label className="block text-[14px]">
        <span className="font-medium">Mot de passe</span>
        <input type="password" required autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px]" />
      </label>
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <button type="submit" disabled={envoi} className="w-full rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-plane disabled:opacity-50">
        {envoi ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
