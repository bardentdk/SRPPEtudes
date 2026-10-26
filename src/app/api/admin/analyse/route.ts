// Analyse IA des réponses (Groq, API compatible OpenAI). Lancée uniquement par un administrateur.
// Groq ne reçoit que des données anonymisées : aucune coordonnée (stockées à part), et les textes
// libres sont débarrassés des e-mails, téléphones, liens et pseudonymes.

import { adminConnecte, nonAutorise } from "@/lib/admin";
import { agreger } from "@/lib/questionnaire/agregation";
import { COMMUNES } from "@/lib/questionnaire/communes";
import { ID_PERSONNELS } from "@/lib/questionnaire/schema";
import { anonymiser, lireFiltres, lireReponses } from "@/lib/questionnaire/serveur";
import { sql } from "@/lib/db";

const ANALYSES_PAR_HEURE = 10;
const MAX_REPONSES = 400;
const NOM_COMMUNE = Object.fromEntries(Object.entries(COMMUNES).map(([nom, code]) => [code, nom]));

const CONSIGNE = `Tu es analyste pour une étude de faisabilité menée à La Réunion : importer du SP98 (absent de l'île) et produire localement de l'E85 à partir de la canne à sucre. On te donne les réponses anonymisées d'un questionnaire (particuliers, professionnels de l'automobile, clubs, stations-service et distributeurs, filière canne) et leurs agrégats.
Les champs wtp98_chaque et wtp98_parfois sont les surcoûts maximaux (€/L) acceptés pour le SP98 par rapport au SP95, wtpe85 le prix maximal (€/L) accepté pour l'E85.
Rédige en français une synthèse structurée en Markdown, factuelle et chiffrée, avec ces sections :
1. Points clés (5 puces maximum)
2. Demande par public
3. Prix acceptables : SP98 et E85
4. Implantation : zones et communes qui ressortent
5. Filière canne et stations : conditions exprimées
6. Signaux faibles tirés des remarques
7. Arguments à présenter à la SRPP, et limites de l'échantillon
N'invente aucun chiffre absent des données, signale quand un effectif est trop faible pour conclure, et ne cherche jamais à identifier une personne.`;

export async function GET() {
  if (!(await adminConnecte())) return nonAutorise();
  const analyses = await sql`select id, cree_le, auteur, filtres, modele, nb_reponses, resultat from analyses_ia order by cree_le desc limit 20`;
  return Response.json({ analyses });
}

export async function POST(request: Request) {
  const admin = await adminConnecte();
  if (!admin) return nonAutorise();
  const cle = process.env.GROQ_API_KEY;
  if (!cle) return Response.json({ error: "Analyse IA non configurée (GROQ_API_KEY)." }, { status: 503 });

  const [{ n }] = (await sql`select count(*)::int as n from analyses_ia where cree_le > now() - interval '1 hour'`) as { n: number }[];
  if (n >= ANALYSES_PAR_HEURE) return Response.json({ error: "Limite de 10 analyses par heure atteinte." }, { status: 429 });

  const params = new URL(request.url).searchParams;
  const filtres = lireFiltres(params);
  const lignes = await lireReponses(filtres, MAX_REPONSES);
  if (!lignes.length) return Response.json({ error: "Aucune réponse à analyser avec ces filtres." }, { status: 400 });

  const anonymes = lignes.map((l) => ({
    public: l.public,
    profil: l.profil,
    commune: l.commune_code ? NOM_COMMUNE[l.commune_code] ?? l.commune_code : null,
    ...Object.fromEntries(Object.entries(l.donnees)
      .filter(([k]) => !ID_PERSONNELS.includes(k))
      .map(([k, v]) => [k, typeof v === "string" ? anonymiser(v) : v])),
  }));
  const modele = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modele,
      temperature: 0.2,
      messages: [
        { role: "system", content: CONSIGNE },
        { role: "user", content: `Agrégats :\n${JSON.stringify(agreger(lignes))}\n\nRéponses (${anonymes.length}) :\n${JSON.stringify(anonymes)}` },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) {
    // Message d'erreur de Groq (modèle retiré, quota…) : utile à l'admin, sans rien de sensible.
    const detail = ((await res?.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
    return Response.json({ error: `Groq a refusé la demande (${res?.status ?? "réseau"})${detail ? ` : ${detail}` : "."}` }, { status: 502 });
  }
  const corps = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const resultat = corps.choices?.[0]?.message?.content?.trim();
  if (!resultat) return Response.json({ error: "Réponse vide de Groq." }, { status: 502 });

  const [analyse] = await sql`
    insert into analyses_ia (auteur, filtres, modele, nb_reponses, resultat)
    values (${admin}, ${JSON.stringify(filtres)}::jsonb, ${modele}, ${lignes.length}, ${resultat})
    returning id, cree_le, auteur, filtres, modele, nb_reponses, resultat`;
  return Response.json({ analyse });
}
