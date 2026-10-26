import { supabaseSession } from "@/lib/supabase/serveur";

export async function POST() {
  const supabase = await supabaseSession();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
