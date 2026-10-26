// Réception d'une réponse au questionnaire : validation par le schéma, protections anti-spam,
// enregistrement dans Supabase (coordonnées à part), puis copie dans la Google Sheet.

import { COMMUNES, NOMS_COMMUNES } from "@/lib/questionnaire/communes";
import { ID_PERSONNELS, VERSION_SCHEMA, nettoyer, publicDe, valider, type Reponses } from "@/lib/questionnaire/schema";
import { empreinteIp, envoyerSheet, ligneSheet } from "@/lib/questionnaire/serveur";
import { supabaseAdmin, supabaseConfigure } from "@/lib/supabase/serveur";

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
  if (!supabaseConfigure()) {
    return Response.json({ error: "Le questionnaire n'est pas encore ouvert." }, { status: 503 });
  }

  const db = supabaseAdmin();
  const ip_hash = await empreinteIp(request);
  const depuis = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("reponses").select("id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("cree_le", depuis);
  if ((count ?? 0) >= ENVOIS_PAR_HEURE) {
    return Response.json({ error: "Trop d'envois depuis cette connexion. Réessayez plus tard." }, { status: 429 });
  }

  const donnees = Object.fromEntries(Object.entries(reponses).filter(([k]) => !ID_PERSONNELS.includes(k)));
  const { data: ligne, error } = await db
    .from("reponses")
    .insert({ public: pub, profil: reponses.profil, commune_code: COMMUNES[String(reponses.commune)] ?? null, donnees, version_schema: VERSION_SCHEMA, ip_hash })
    .select("id, cree_le, public, profil, commune_code, donnees")
    .single();
  if (error || !ligne) {
    return Response.json({ error: "Enregistrement impossible pour le moment." }, { status: 500 });
  }

  const consentement = Array.isArray(reponses.contact_consentement) && reponses.contact_consentement.length > 0;
  const contact = consentement
    ? { nom: (reponses.contact_nom as string) ?? null, structure: (reponses.contact_structure as string) ?? null, email: (reponses.contact_email as string) ?? null, consentement }
    : null;
  if (contact) await db.from("contacts").insert({ reponse_id: ligne.id, ...contact });

  if (await envoyerSheet(ligneSheet(ligne, contact))) {
    await db.from("reponses").update({ sheet_sync: true }).eq("id", ligne.id);
  }
  return Response.json({ ok: true }, { status: 201 });
}
