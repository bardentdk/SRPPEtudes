import { NextResponse } from "next/server";
import { supabaseSession } from "@/lib/supabase/serveur";

/** Retour du lien magique : échange le code contre une session, puis ouvre l'espace admin. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await supabaseSession();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/admin", url.origin));
  }
  return NextResponse.redirect(new URL("/admin/connexion?erreur=lien", url.origin));
}
