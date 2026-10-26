import "server-only";
import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

// Connexion à l'espace admin : e-mail + mot de passe, inscription fermée.
// Les comptes sont créés par scripts/creer-admin.mjs ; l'accès est ensuite réservé
// aux adresses de ADMIN_EMAILS (src/lib/admin.ts).
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
  session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 }, // 8 h, prolongée à l'usage
  rateLimit: {
    enabled: true,
    storage: "database", // partagé entre les fonctions serverless
    customRules: { "/sign-in/email": { window: 300, max: 5 } }, // 5 essais par 5 min
  },
  plugins: [nextCookies()],
});
