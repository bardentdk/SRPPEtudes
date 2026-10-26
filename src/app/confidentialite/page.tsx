import type { Metadata } from "next";
import PageSimple from "@/components/PageSimple";

export const metadata: Metadata = { title: "Données personnelles · Carburants Réunion" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function Page() {
  return (
    <PageSimple titre="Données personnelles" sousTitre="Comment sont traitées les réponses au questionnaire de l'Étude Carburants Réunion 2026.">
      <div className="space-y-5 rounded-2xl border border-line bg-surface p-6 text-[14px] leading-relaxed text-ink-2 [&_h2]:mb-1 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-ink">
        <section>
          <h2>Responsable et finalité</h2>
          <p>
            Les réponses sont collectées par l&apos;Étude Carburants Réunion 2026{CONTACT ? <> (contact : <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>)</> : null},
            dans le seul but d&apos;évaluer la demande en SP98 et en E85 à La Réunion et d&apos;en présenter les résultats aux acteurs de la filière.
          </p>
        </section>
        <section>
          <h2>Ce qui est collecté</h2>
          <p>
            Vos réponses, votre commune et, seulement si vous le souhaitez, vos coordonnées avec votre consentement. Une empreinte chiffrée et salée de votre
            adresse IP sert uniquement à limiter les envois abusifs ; l&apos;adresse elle-même n&apos;est pas conservée.
          </p>
        </section>
        <section>
          <h2>Ce qui est publié</h2>
          <p>Uniquement des résultats agrégés, jamais une réponse individuelle. Une répartition fondée sur moins de 3 réponses n&apos;est pas affichée.</p>
        </section>
        <section>
          <h2>Où sont stockées les données</h2>
          <p>
            Dans une base Neon (PostgreSQL) hébergée dans l&apos;Union européenne (Francfort), avec une copie dans une feuille Google Sheets privée. Les coordonnées sont stockées à part
            et ne sont visibles que des administrateurs de l&apos;étude.
          </p>
        </section>
        <section>
          <h2>Analyse automatisée</h2>
          <p>
            Pour produire des synthèses, les administrateurs peuvent soumettre des réponses anonymisées au service d&apos;intelligence artificielle Groq :
            sans aucune coordonnée, et après suppression des e-mails, numéros de téléphone et liens présents dans les textes libres.
          </p>
        </section>
        <section>
          <h2>Durée et droits</h2>
          <p>
            Les données sont conservées 12 mois après la fin de l&apos;étude. Vous pouvez demander leur consultation, leur rectification ou leur suppression
            {CONTACT ? <> en écrivant à <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a></> : " auprès du responsable de l'étude"}, et introduire une réclamation auprès de la CNIL.
          </p>
        </section>
      </div>
    </PageSimple>
  );
}
