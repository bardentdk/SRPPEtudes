import "server-only";
import { supabaseAdmin } from "../supabase/serveur";
import { QUESTIONS, type Reponses } from "./schema";
import type { LigneReponse } from "./agregation";
import type { Public } from "../types";

export interface ReponseStockee extends LigneReponse {
  id: string;
  sheet_sync: boolean;
  version_schema: number;
}

export interface Contact { nom: string | null; structure: string | null; email: string | null; consentement: boolean }

export interface Filtres {
  public?: Public | null;
  commune?: string | null;
  du?: string | null;
  au?: string | null;
  contact?: "oui" | "non" | null;
}

export function lireFiltres(params: URLSearchParams): Filtres {
  const p = params.get("public");
  return {
    public: (["part", "pro", "club", "station", "filiere"] as const).find((x) => x === p) ?? null,
    commune: params.get("commune") || null,
    du: params.get("du") || null,
    au: params.get("au") || null,
    contact: params.get("contact") === "oui" ? "oui" : params.get("contact") === "non" ? "non" : null,
  };
}

const COLONNES = "id, cree_le, public, profil, commune_code, donnees, sheet_sync, version_schema";

/** Réponses filtrées, triées de la plus récente à la plus ancienne. */
export async function lireReponses(f: Filtres = {}, limite = 5000) {
  let req = supabaseAdmin()
    .from("reponses")
    .select(f.contact ? `${COLONNES}, contacts!inner(consentement)` : COLONNES)
    .order("cree_le", { ascending: false })
    .limit(limite);
  if (f.public) req = req.eq("public", f.public);
  if (f.commune) req = req.eq("commune_code", f.commune);
  if (f.du) req = req.gte("cree_le", f.du);
  if (f.au) req = req.lte("cree_le", `${f.au}T23:59:59`);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  let lignes = (data ?? []) as unknown as ReponseStockee[];
  if (f.contact === "non") {
    const { data: avec } = await supabaseAdmin().from("contacts").select("reponse_id");
    const ids = new Set((avec ?? []).map((c) => c.reponse_id));
    lignes = lignes.filter((l) => !ids.has(l.id));
  }
  return lignes;
}

/** Empreinte salée de l'adresse IP : permet de limiter les envois sans conserver l'adresse. */
export async function empreinteIp(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
  const donnees = new TextEncoder().encode(`${process.env.IP_HASH_SALT ?? ""}:${ip}`);
  const hash = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ligne à plat pour la Google Sheet : une colonne par question, valeurs multiples séparées par « ; ». */
export function ligneSheet(r: { id: string; cree_le: string; public: string; profil: string; commune_code: string | null; donnees: Reponses }, contact?: Contact | null) {
  const ligne: Record<string, string | number> = {
    id: r.id, cree_le: r.cree_le, public: r.public, profil: r.profil, commune_code: r.commune_code ?? "",
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
