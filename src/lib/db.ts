import "server-only";
import { neon } from "@neondatabase/serverless";

// Base Neon (Postgres). DATABASE_URL est une variable serveur : elle ne doit jamais porter
// le préfixe NEXT_PUBLIC_, qui l'enverrait au navigateur.
const url = process.env.DATABASE_URL;

export const dbConfiguree = () => Boolean(url);

/** Requêtes HTTP vers Neon : adapté aux fonctions Vercel, sans connexion persistante. */
export const sql = neon(url ?? "postgresql://non-configure@localhost/aucune");
