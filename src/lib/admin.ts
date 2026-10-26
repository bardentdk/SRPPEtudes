import "server-only";
import { supabaseConfigure, supabaseSession } from "./supabase/serveur";

const admins = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/** E-mail de l'administrateur connecté, ou null. À appeler dans chaque route et page admin :
 *  le proxy ne fait que rediriger, il ne protège pas les données. */
export async function adminConnecte(): Promise<string | null> {
  if (!supabaseConfigure()) return null;
  const supabase = await supabaseSession();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  return email && admins().includes(email) ? email : null;
}

export const nonAutorise = () => Response.json({ error: "Accès réservé aux administrateurs." }, { status: 401 });
