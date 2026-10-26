// Crée (ou met à jour le mot de passe d') un compte administrateur.
//
//   node --env-file=.env.local scripts/creer-admin.mjs
//
// Le mot de passe est saisi sans écho et n'est jamais affiché ni enregistré en clair :
// seul son hachage (format Better Auth) est stocké. L'adresse doit aussi figurer dans
// ADMIN_EMAILS pour ouvrir l'espace admin.

import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL absente.");
  process.exit(1);
}
console.log(`Base visée : ${new URL(url).hostname.split(".")[0]}`);

/** Saisie sans écho : le terminal passe en mode brut et rien n'est affiché pendant la frappe. */
function demanderMasque(question) {
  const stdin = process.stdin;
  process.stdout.write(question);
  if (!stdin.isTTY) throw new Error("Lancez le script dans un terminal pour saisir le mot de passe.");
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve, reject) => {
    let saisie = "";
    const fin = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", surFrappe);
      process.stdout.write("\n");
    };
    const surFrappe = (morceau) => {
      for (const c of morceau) {
        if (c === "\r" || c === "\n") return fin(), resolve(saisie);
        if (c === "\u0003") return fin(), reject(new Error("Saisie annulée."));
        if (c === "\u007f" || c === "\b") saisie = saisie.slice(0, -1);
        else saisie += c;
      }
    };
    stdin.on("data", surFrappe);
  });
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (await rl.question("Adresse e-mail de l'admin : ")).trim().toLowerCase();
rl.close();
const motDePasse = await demanderMasque("Mot de passe (12 caractères minimum, rien ne s'affiche) : ");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse invalide.");
if (motDePasse.length < 12) throw new Error("Mot de passe trop court.");
const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
if (!admins.includes(email)) console.warn("Attention : cette adresse n'est pas dans ADMIN_EMAILS, elle ne pourra pas ouvrir l'espace admin.");

const hash = await hashPassword(motDePasse);
const pool = new Pool({ connectionString: url });
try {
  const existant = (await pool.query(`select "id" from "user" where "email" = $1`, [email])).rows[0];
  if (existant) {
    await pool.query(`update "account" set "password" = $1, "updatedAt" = now() where "userId" = $2 and "providerId" = 'credential'`, [hash, existant.id]);
    await pool.query(`delete from "session" where "userId" = $1`, [existant.id]);
    console.log("Mot de passe mis à jour ; sessions existantes fermées.");
  } else {
    const id = randomUUID();
    await pool.query(`insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, $2, $3, true, now())`, [id, email.split("@")[0], email]);
    await pool.query(`insert into "account" ("id", "accountId", "providerId", "userId", "password", "updatedAt") values ($1, $2, 'credential', $2, $3, now())`, [randomUUID(), id, hash]);
    console.log("Compte admin créé.");
  }
} finally {
  await pool.end();
}
