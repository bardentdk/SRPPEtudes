import { adminConnecte, nonAutorise } from "@/lib/admin";
import { envoyerSheet, ligneSheet } from "@/lib/questionnaire/serveur";
import { supabaseAdmin } from "@/lib/supabase/serveur";

/** Renvoie vers la Google Sheet les réponses dont la copie a échoué. */
export async function POST() {
  if (!(await adminConnecte())) return nonAutorise();
  const db = supabaseAdmin();
  const { data: lignes } = await db.from("reponses").select("id, cree_le, public, profil, commune_code, donnees").eq("sheet_sync", false).limit(200);
  let envoyees = 0;
  for (const l of lignes ?? []) {
    const { data: contact } = await db.from("contacts").select("nom, structure, email, consentement").eq("reponse_id", l.id).maybeSingle();
    if (await envoyerSheet(ligneSheet(l, contact))) {
      await db.from("reponses").update({ sheet_sync: true }).eq("id", l.id);
      envoyees++;
    }
  }
  return Response.json({ a_envoyer: lignes?.length ?? 0, envoyees });
}
