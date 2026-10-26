import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { dbConfiguree } from "./db";

const admins = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/** E-mail de l'administrateur connecté, ou null. À appeler dans chaque route et page admin :
 *  le proxy ne fait que rediriger, il ne protège pas les données. */
export async function adminConnecte(): Promise<string | null> {
  if (!dbConfiguree() || !process.env.BETTER_AUTH_SECRET) return null;
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const email = session?.user.email?.toLowerCase();
  return email && admins().includes(email) ? email : null;
}

export const nonAutorise = () => Response.json({ error: "Accès réservé aux administrateurs." }, { status: 401 });
