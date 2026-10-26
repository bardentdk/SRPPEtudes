import type { ReactNode } from "react";

/** Rendu Markdown minimal pour les synthèses IA : titres, listes, tableaux, séparateurs, gras. Aucun HTML brut n'est interprété. */
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
  let tableau: string[][] | null = null;
  const fermerTableau = () => {
    if (!tableau) return;
    const [entete, ...corps] = tableau;
    blocs.push(
      <div key={blocs.length} className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead><tr>{entete.map((c, i) => <th key={i} className="border-b border-line px-2 py-1.5 font-semibold">{enLigne(c)}</th>)}</tr></thead>
          <tbody>{corps.map((r, i) => <tr key={i} className="border-b border-line">{r.map((c, k) => <td key={k} className="px-2 py-1.5 align-top">{enLigne(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>,
    );
    tableau = null;
  };
  for (const brute of texte.split("\n")) {
    const ligne = brute.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(ligne)) {
      fermer();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(ligne)) continue; // ligne de séparation de l'en-tête
      tableau ??= [];
      tableau.push(ligne.trim().slice(1, -1).split("|").map((c) => c.trim()));
      continue;
    }
    if (tableau && !ligne.trim()) continue; // lignes vides entre les rangées
    fermerTableau();
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ligne)) {
      fermer();
      blocs.push(<hr key={blocs.length} className="my-3 border-line" />);
      continue;
    }
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
  fermerTableau();
  return <div className="space-y-2 text-[13.5px] leading-relaxed">{blocs}</div>;
}
