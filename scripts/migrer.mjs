// Applique les migrations de db/migrations dans l'ordre, une seule fois chacune.
//
//   node --env-file=.env.local scripts/migrer.mjs           → affiche la base visée et ce qui reste à appliquer
//   node --env-file=.env.local scripts/migrer.mjs --appliquer → applique, dans une transaction par fichier
//
// La base visée est celle de DATABASE_URL : vérifier qu'il s'agit bien de la branche voulue
// (dev pour les essais) avant de passer --appliquer.

import { readdir, readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL absente.");
  process.exit(1);
}
const hote = new URL(url).hostname;
console.log(`Base visée : ${hote.split(".")[0]} (${new URL(url).pathname.slice(1)})`);

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  // Lecture seule tant que --appliquer n'est pas passé : la table de suivi n'est créée qu'à l'application.
  const suivi = (await client.query("select to_regclass('migrations_appliquees') as t")).rows[0].t;
  const faites = new Set(suivi ? (await client.query("select nom from migrations_appliquees")).rows.map((r) => r.nom) : []);
  const fichiers = (await readdir(new URL("../db/migrations/", import.meta.url))).filter((f) => f.endsWith(".sql")).sort();
  const restantes = fichiers.filter((f) => !faites.has(f));
  console.log(restantes.length ? `À appliquer : ${restantes.join(", ")}` : "Base à jour.");
  if (!process.argv.includes("--appliquer") || !restantes.length) process.exit(0);

  await client.query("create table if not exists migrations_appliquees (nom text primary key, appliquee_le timestamptz not null default now())");
  for (const f of restantes) {
    const texte = await readFile(new URL(`../db/migrations/${f}`, import.meta.url), "utf8");
    await client.query("begin");
    try {
      await client.query(texte);
      await client.query("insert into migrations_appliquees (nom) values ($1)", [f]);
      await client.query("commit");
      console.log(`Appliquée : ${f}`);
    } catch (e) {
      await client.query("rollback");
      console.error(`Échec sur ${f} (annulée) : ${e.message}`);
      process.exit(1);
    }
  }
} finally {
  client.release();
  await pool.end();
}
