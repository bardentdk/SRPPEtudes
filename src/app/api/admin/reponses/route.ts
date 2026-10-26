import { adminConnecte, nonAutorise } from "@/lib/admin";
import { lireFiltres, lireReponses } from "@/lib/questionnaire/serveur";

/** Réponses filtrées pour l'espace admin, avec un indicateur de coordonnées (sans les coordonnées). */
export async function GET(request: Request) {
  const admin = await adminConnecte();
  if (!admin) return nonAutorise();
  const reponses = await lireReponses(lireFiltres(new URL(request.url).searchParams));
  return Response.json({ admin, reponses });
}
