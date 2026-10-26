// Agrégats publics du questionnaire (seuil de 3 réponses par répartition), lus par le tableau de bord.

import { connection } from "next/server";
import { agreger } from "@/lib/questionnaire/agregation";
import { lireReponses } from "@/lib/questionnaire/serveur";
import { dbConfiguree } from "@/lib/db";

export async function GET() {
  await connection(); // toujours calculé à la requête, jamais figé au build
  if (!dbConfiguree()) return Response.json({ disponible: false });
  try {
    const agregats = agreger(await lireReponses());
    return Response.json(agregats, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ disponible: false }, { status: 503 });
  }
}
