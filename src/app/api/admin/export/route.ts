import { adminConnecte, nonAutorise } from "@/lib/admin";
import { lireFiltres, lireReponses, ligneSheet, type Contact } from "@/lib/questionnaire/serveur";
import { sql } from "@/lib/db";

const cellule = (v: string | number) => {
  const s = String(v);
  // guillemets doublés ; préfixe contre l'injection de formules dans un tableur
  const sur = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
};

/** Export CSV (séparateur « ; », lisible par Excel en français). Coordonnées seulement si contacts=1. */
export async function GET(request: Request) {
  if (!(await adminConnecte())) return nonAutorise();
  const params = new URL(request.url).searchParams;
  const lignes = await lireReponses(lireFiltres(params));
  const avecContacts = params.get("contacts") === "1";
  const contacts = new Map<string, Contact>();
  if (avecContacts) {
    const lignesContacts = (await sql`select reponse_id, nom, structure, email, consentement from contacts`) as (Contact & { reponse_id: string })[];
    for (const c of lignesContacts) contacts.set(c.reponse_id, c);
  }
  const rangs = lignes.map((l) => {
    const r = ligneSheet(l, contacts.get(l.id));
    if (!avecContacts) {
      delete r.contact_nom;
      delete r.contact_structure;
      delete r.contact_email;
      delete r.contact_consentement;
    }
    return r;
  });
  const entetes = rangs.length ? Object.keys(rangs[0]) : ["id"];
  const csv = "﻿" + [entetes.join(";"), ...rangs.map((r) => entetes.map((k) => cellule(r[k] ?? "")).join(";"))].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reponses-${new Date().toISOString().slice(0, 10)}${avecContacts ? "-avec-contacts" : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
