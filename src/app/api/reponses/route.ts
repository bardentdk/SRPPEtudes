// Réception d'une réponse au questionnaire : validation par le schéma, protections anti-spam,
// enregistrement dans Neon (coordonnées à part), puis copie dans la Google Sheet.

import { COMMUNES, NOMS_COMMUNES } from "@/lib/questionnaire/communes";
import { ID_PERSONNELS, VERSION_SCHEMA, nettoyer, publicDe, valider, type Reponses } from "@/lib/questionnaire/schema";
import { empreinteIp, envoyerSheet, ligneSheet } from "@/lib/questionnaire/serveur";
import { dbConfiguree, sql } from "@/lib/db";

const DUREE_MIN_MS = 20_000; // un humain met plus de 20 s à remplir le questionnaire
const ENVOIS_PAR_HEURE = 5;

export async function POST(request: Request) {
  const corps = (await request.json().catch(() => null)) as { reponses?: Reponses; debut?: number; site_web?: string } | null;
  if (!corps?.reponses || typeof corps.reponses !== "object") {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  // Champ piège invisible et durée de remplissage : on répond « merci » sans rien enregistrer.
  if (corps.site_web || !corps.debut || Date.now() - corps.debut < DUREE_MIN_MS) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const reponses = nettoyer(corps.reponses);
  const erreurs = valider(reponses, NOMS_COMMUNES);
  const pub = publicDe(reponses);
  if (!pub || Object.keys(erreurs).length) {
    return Response.json({ error: "Certaines réponses sont invalides.", erreurs }, { status: 422 });
  }
  if (!dbConfiguree()) {
    return Response.json({ error: "Le questionnaire n'est pas encore ouvert." }, { status: 503 });
  }

  const ip_hash = await empreinteIp(request);
  const [{ n }] = (await sql`select count(*)::int as n from reponses where ip_hash = ${ip_hash} and cree_le > now() - interval '1 hour'`) as { n: number }[];
  if (n >= ENVOIS_PAR_HEURE) {
    return Response.json({ error: "Trop d'envois depuis cette connexion. Réessayez plus tard." }, { status: 429 });
  }

  const donnees = Object.fromEntries(Object.entries(reponses).filter(([k]) => !ID_PERSONNELS.includes(k)));
  const consentement = Array.isArray(reponses.contact_consentement) && reponses.contact_consentement.length > 0;
  const contact = consentement
    ? { nom: (reponses.contact_nom as string) ?? null, structure: (reponses.contact_structure as string) ?? null, email: (reponses.contact_email as string) ?? null, consentement }
    : null;

  let ligne: { id: string; cree_le: string; public: string; profil: string; commune_code: string | null; donnees: Reponses };
  try {
    [ligne] = (await sql`
      insert into reponses (public, profil, commune_code, donnees, version_schema, ip_hash)
      values (${pub}, ${String(reponses.profil)}, ${COMMUNES[String(reponses.commune)] ?? null}, ${JSON.stringify(donnees)}::jsonb, ${VERSION_SCHEMA}, ${ip_hash})
      returning id, cree_le, public, profil, commune_code, donnees`) as (typeof ligne)[];
    if (contact) {
      await sql`insert into contacts (reponse_id, nom, structure, email, consentement)
                values (${ligne.id}, ${contact.nom}, ${contact.structure}, ${contact.email}, ${contact.consentement})`;
    }
  } catch {
    return Response.json({ error: "Enregistrement impossible pour le moment." }, { status: 500 });
  }

  if (await envoyerSheet(ligneSheet(ligne, contact))) {
    await sql`update reponses set sheet_sync = true where id = ${ligne.id}`;
  }
  return Response.json({ ok: true }, { status: 201 });
}
