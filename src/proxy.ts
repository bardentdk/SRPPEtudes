import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Renvoie vers la connexion quiconque ouvre /admin sans cookie de session.
// Ce n'est qu'un aiguillage (le cookie n'est pas vérifié ici) : chaque page et route admin
// revérifie la session et l'adresse autorisée (src/lib/admin.ts).
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/connexion") || getSessionCookie(request)) {
    return NextResponse.next();
  }
  const connexion = request.nextUrl.clone();
  connexion.pathname = "/admin/connexion";
  connexion.search = "";
  return NextResponse.redirect(connexion);
}

export const config = {
  matcher: ["/admin/:path*"],
};
