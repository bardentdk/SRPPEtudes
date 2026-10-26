import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // clé anon ou « publishable »
const SECRETE = process.env.SUPABASE_SERVICE_ROLE_KEY; // clé service_role ou « secret »

export const supabaseConfigure = () => Boolean(URL && PUBLIQUE && SECRETE);

/** Client lié à la session de l'utilisateur (cookies) : sert uniquement à l'authentification. */
export async function supabaseSession() {
  const store = await cookies();
  return createServerClient(URL!, PUBLIQUE!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (liste) => {
        try {
          liste.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // appelé depuis un composant serveur : le proxy rafraîchit la session à la place
        }
      },
    },
  });
}

/** Client privilégié (contourne la RLS) : réservé aux routes serveur, jamais exposé au navigateur. */
export function supabaseAdmin() {
  return createClient(URL!, SECRETE!, { auth: { persistSession: false, autoRefreshToken: false } });
}
