import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session Supabase et renvoie vers la connexion quiconque ouvre /admin sans session.
// Ce n'est qu'un aiguillage : chaque page et route admin revérifie l'administrateur (src/lib/admin.ts).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return response;

  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (liste) => {
        liste.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        liste.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  const libre = request.nextUrl.pathname.startsWith("/admin/connexion") || request.nextUrl.pathname.startsWith("/admin/auth");
  if (!data.user && !libre) {
    const connexion = request.nextUrl.clone();
    connexion.pathname = "/admin/connexion";
    connexion.search = "";
    return NextResponse.redirect(connexion);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
