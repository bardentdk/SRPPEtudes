import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import PageSimple from "@/components/PageSimple";
import Admin from "@/components/admin/Admin";
import { adminConnecte } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin · Carburants Réunion", robots: { index: false } };

/** Vérification côté serveur : le proxy redirige, mais seule cette garde (et celle des routes API) protège. */
async function Garde() {
  await connection(); // toujours vérifié à la requête, jamais figé au build
  const email = await adminConnecte();
  if (!email) redirect("/admin/connexion");
  return <Admin email={email} />;
}

export default function Page() {
  return (
    <PageSimple titre="Réponses au questionnaire" sousTitre="Tri, filtres, export et analyse des réponses. Les coordonnées ne sont visibles qu'ici." large>
      <Suspense fallback={<p className="text-[13px] text-muted">Vérification de l&apos;accès…</p>}>
        <Garde />
      </Suspense>
    </PageSimple>
  );
}
