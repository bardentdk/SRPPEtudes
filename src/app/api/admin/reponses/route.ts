import { adminConnecte, nonAutorise } from "@/lib/admin";
import { lireFiltres, lireReponses } from "@/lib/questionnaire/serveur";
import { supabaseAdmin } from "@/lib/supabase/serveur";

/** Réponses filtrées pour l'espace admin, avec un indicateur de coordonnées (sans les coordonnées). */
export async function GET(request: Request) {
  const admin = await adminConnecte();
  if (!admin) return nonAutorise();
  const filtres = lireFiltres(new URL(request.url).searchParams);
  const lignes = await lireReponses(filtres);
  const { data: contacts } = await supabaseAdmin().from("contacts").select("reponse_id");
  const avecContact = new Set((contacts ?? []).map((c) => c.reponse_id));
  return Response.json({ admin, reponses: lignes.map((l) => ({ ...l, contact: avecContact.has(l.id) })) });
}
