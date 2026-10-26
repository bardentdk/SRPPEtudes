import { adminConnecte, nonAutorise } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/serveur";

/** Fiche complète d'une réponse, coordonnées comprises (visibles dans l'espace admin uniquement). */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/reponses/[id]">) {
  if (!(await adminConnecte())) return nonAutorise();
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const [{ data: reponse }, { data: contact }] = await Promise.all([
    db.from("reponses").select("id, cree_le, public, profil, commune_code, donnees, sheet_sync, version_schema").eq("id", id).maybeSingle(),
    db.from("contacts").select("nom, structure, email, consentement").eq("reponse_id", id).maybeSingle(),
  ]);
  if (!reponse) return Response.json({ error: "Réponse introuvable." }, { status: 404 });
  return Response.json({ reponse, contact });
}

/** Suppression définitive (demande d'effacement RGPD) : la réponse et ses coordonnées. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/reponses/[id]">) {
  if (!(await adminConnecte())) return nonAutorise();
  const { id } = await ctx.params;
  const { error, count } = await supabaseAdmin().from("reponses").delete({ count: "exact" }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ supprimees: count ?? 0 });
}
