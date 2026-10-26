import { adminConnecte, nonAutorise } from "@/lib/admin";
import { sql } from "@/lib/db";
import { envoyerSheet, ligneSheet, type Contact } from "@/lib/questionnaire/serveur";
import type { Reponses } from "@/lib/questionnaire/schema";

/** Renvoie vers la Google Sheet les réponses dont la copie a échoué. */
export async function POST() {
  if (!(await adminConnecte())) return nonAutorise();
  const lignes = (await sql`
    select r.id, r.cree_le, r.public, r.profil, r.commune_code, r.donnees,
           c.nom, c.structure, c.email, c.consentement
      from reponses r left join contacts c on c.reponse_id = r.id
     where not r.sheet_sync order by r.cree_le limit 200`) as ({ id: string; cree_le: string; public: string; profil: string; commune_code: string | null; donnees: Reponses } & Partial<Contact>)[];
  let envoyees = 0;
  for (const l of lignes) {
    const contact = l.consentement ? { nom: l.nom ?? null, structure: l.structure ?? null, email: l.email ?? null, consentement: true } : null;
    if (await envoyerSheet(ligneSheet(l, contact))) {
      await sql`update reponses set sheet_sync = true where id = ${l.id}`;
      envoyees++;
    }
  }
  return Response.json({ a_envoyer: lignes.length, envoyees });
}
