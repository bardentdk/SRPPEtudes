import { adminConnecte, nonAutorise } from "@/lib/admin";
import { sql } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fiche complète d'une réponse, coordonnées comprises (visibles dans l'espace admin uniquement). */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/reponses/[id]">) {
  if (!(await adminConnecte())) return nonAutorise();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Réponse introuvable." }, { status: 404 });
  const [reponse] = await sql`select id, cree_le, public, profil, commune_code, donnees, sheet_sync, version_schema from reponses where id = ${id}`;
  if (!reponse) return Response.json({ error: "Réponse introuvable." }, { status: 404 });
  const [contact] = await sql`select nom, structure, email, consentement from contacts where reponse_id = ${id}`;
  return Response.json({ reponse, contact: contact ?? null });
}

/** Suppression définitive (demande d'effacement RGPD) : la réponse et, en cascade, ses coordonnées. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/reponses/[id]">) {
  if (!(await adminConnecte())) return nonAutorise();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ supprimees: 0 });
  const supprimees = await sql`delete from reponses where id = ${id} returning id`;
  return Response.json({ supprimees: supprimees.length });
}
