import type { ReactNode } from "react";

/** Rendu Markdown minimal pour les synthèses IA : titres, listes, gras. Aucun HTML brut n'est interprété. */
function enLigne(texte: string): ReactNode[] {
  return texte.split(/(\*\*[^*]+\*\*)/g).map((morceau, i) =>
    morceau.startsWith("**") && morceau.endsWith("**") ? <strong key={i}>{morceau.slice(2, -2)}</strong> : morceau,
  );
}

export default function Markdown({ texte }: { texte: string }) {
  const blocs: ReactNode[] = [];
  let liste: { ordonnee: boolean; items: string[] } | null = null;
  const fermer = () => {
    if (!liste) return;
    const Tag = liste.ordonnee ? "ol" : "ul";
    blocs.push(
      <Tag key={blocs.length} className={`${liste.ordonnee ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
        {liste.items.map((it, i) => <li key={i}>{enLigne(it)}</li>)}
      </Tag>,
    );
    liste = null;
  };
  for (const brute of texte.split("\n")) {
    const ligne = brute.trimEnd();
    const titre = /^(#{1,4})\s+(.*)$/.exec(ligne);
    const puce = /^\s*[-*]\s+(.*)$/.exec(ligne);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(ligne);
    if (titre) {
      fermer();
      blocs.push(<h3 key={blocs.length} className="mt-4 text-[15px] font-semibold first:mt-0">{enLigne(titre[2])}</h3>);
    } else if (puce || numero) {
      const ordonnee = !!numero;
      if (liste && liste.ordonnee !== ordonnee) fermer();
      liste ??= { ordonnee, items: [] };
      liste.items.push((puce ?? numero)![1]);
    } else if (ligne.trim()) {
      fermer();
      blocs.push(<p key={blocs.length}>{enLigne(ligne)}</p>);
    } else {
      fermer();
    }
  }
  fermer();
  return <div className="space-y-2 text-[13.5px] leading-relaxed">{blocs}</div>;
}
