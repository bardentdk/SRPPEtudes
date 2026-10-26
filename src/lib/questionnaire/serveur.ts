import "server-only";
import { sql } from "../db";
import { QUESTIONS, type Reponses } from "./schema";
import type { LigneReponse } from "./agregation";
import type { Public } from "../types";

export interface ReponseStockee extends LigneReponse {
  id: string;
  sheet_sync: boolean;
  version_schema: number;
  contact: boolean;
}

export interface Contact { nom: string | null; structure: string | null; email: string | null; consentement: boolean }

export interface Filtres {
  public?: Public | null;
  commune?: string | null;
  du?: string | null;
  au?: string | null;
  contact?: "oui" | "non" | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function lireFiltres(params: URLSearchParams): Filtres {
  const p = params.get("public");
  const date = (k: string) => (DATE.test(params.get(k) ?? "") ? params.get(k) : null);
  return {
    public: (["part", "pro", "club", "station", "filiere"] as const).find((x) => x === p) ?? null,
    commune: /^974\d{2}$/.test(params.get("commune") ?? "") ? params.get("commune") : null,
    du: date("du"),
    au: date("au"),
    contact: params.get("contact") === "oui" ? "oui" : params.get("contact") === "non" ? "non" : null,
  };
}

const AVEC_CONTACT = "exists (select 1 from contacts c where c.reponse_id = r.id)";

/** Réponses filtrées, de la plus récente à la plus ancienne (requête paramétrée). */
export async function lireReponses(f: Filtres = {}, limite = 5000): Promise<ReponseStockee[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];
  const ajouter = (condition: string, valeur: unknown) => {
    valeurs.push(valeur);
    conditions.push(condition.replace("?", `$${valeurs.length}`));
  };
  if (f.public) ajouter("r.public = ?", f.public);
  if (f.commune) ajouter("r.commune_code = ?", f.commune);
  if (f.du) ajouter("r.cree_le >= ?::date", f.du);
  if (f.au) ajouter("r.cree_le < (?::date + 1)", f.au);
  if (f.contact) conditions.push(f.contact === "oui" ? AVEC_CONTACT : `not ${AVEC_CONTACT}`);
  valeurs.push(Math.min(Math.max(1, Math.floor(limite)), 5000));
  const lignes = (await sql.query(
    `select r.id, r.cree_le, r.public, r.profil, r.commune_code, r.donnees, r.sheet_sync, r.version_schema, ${AVEC_CONTACT} as contact
       from reponses r ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by r.cree_le desc limit $${valeurs.length}`,
    valeurs,
  )) as (Omit<ReponseStockee, "cree_le"> & { cree_le: string | Date })[];
  return lignes.map((l) => ({ ...l, cree_le: new Date(l.cree_le).toISOString() }));
}

/** Empreinte salée de l'adresse IP : permet de limiter les envois sans conserver l'adresse. */
export async function empreinteIp(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
  const donnees = new TextEncoder().encode(`${process.env.IP_HASH_SALT ?? ""}:${ip}`);
  const hash = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ligne à plat pour la Google Sheet : une colonne par question, valeurs multiples séparées par « ; ». */
export function ligneSheet(r: { id: string; cree_le: string | Date; public: string; profil: string; commune_code: string | null; donnees: Reponses }, contact?: Contact | null) {
  const ligne: Record<string, string | number> = {
    id: r.id, cree_le: new Date(r.cree_le).toISOString(), public: r.public, profil: r.profil, commune_code: r.commune_code ?? "",
  };
  for (const q of QUESTIONS) {
    if (q.personnel) continue;
    const v = r.donnees[q.id];
    ligne[q.id] = Array.isArray(v) ? v.join(" ; ") : v ?? "";
  }
  ligne.contact_nom = contact?.nom ?? "";
  ligne.contact_structure = contact?.structure ?? "";
  ligne.contact_email = contact?.email ?? "";
  ligne.contact_consentement = contact?.consentement ? "oui" : "";
  return ligne;
}

/** Copie vers la Google Sheet via le point de réception Apps Script. Renvoie false si l'envoi échoue. */
export async function envoyerSheet(ligne: Record<string, string | number>) {
  const url = process.env.SHEET_WEBHOOK_URL;
  const jeton = process.env.SHEET_WEBHOOK_TOKEN;
  if (!url || !jeton) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // évite la requête préliminaire CORS côté Google
      body: JSON.stringify({ jeton, ligne }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const corps = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return corps?.ok === true;
  } catch {
    return false;
  }
}

const MOTIFS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail]"],
  [/https?:\/\/\S+|www\.\S+/gi, "[lien]"],
  [/(?:\+|00)\s?\d[\d\s.-]{7,}\d|\b0\d(?:[\s.-]?\d{2}){4}\b/g, "[téléphone]"],
  [/@\w{2,}/g, "[pseudo]"],
];

/** Retire des textes libres ce qui permet de contacter ou d'identifier directement quelqu'un. */
export function anonymiser(texte: string) {
  return MOTIFS.reduce((t, [motif, remplacement]) => t.replace(motif, remplacement), texte);
}
