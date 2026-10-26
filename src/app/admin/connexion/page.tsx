import type { Metadata } from "next";
import PageSimple from "@/components/PageSimple";
import Connexion from "@/components/admin/Connexion";

export const metadata: Metadata = { title: "Connexion admin · Carburants Réunion", robots: { index: false } };

export default function Page() {
  return (
    <PageSimple titre="Espace administrateur" sousTitre="Recevez un lien de connexion par e-mail. Seules les adresses autorisées peuvent accéder aux réponses.">
      <Connexion />
    </PageSimple>
  );
}
