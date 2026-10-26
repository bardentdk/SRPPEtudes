import type { Metadata } from "next";
import Link from "next/link";
import PageSimple from "@/components/PageSimple";
import Questionnaire from "@/components/questionnaire/Questionnaire";

export const metadata: Metadata = {
  title: "Questionnaire · Carburants Réunion",
  description: "Étude Carburants Réunion 2026 : votre avis sur l'arrivée du SP98 et d'un E85 produit à partir de la canne.",
};

export default function Page() {
  return (
    <PageSimple titre="Étude Carburants Réunion 2026"
      sousTitre="Le SP98 n'est pas distribué à La Réunion et aucun carburant n'y est produit à partir de la canne. Ce questionnaire mesure la demande réelle et les conditions économiques. Environ 5 minutes, questions adaptées à votre profil.">
      <Questionnaire />
      <p className="mt-6 text-[12.5px] text-muted">
        Réponses anonymes sauf si vous laissez vos coordonnées. Seuls des résultats agrégés sont publiés. <Link href="/confidentialite" className="underline">Données personnelles</Link>
      </p>
    </PageSimple>
  );
}
