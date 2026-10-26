"use client";

import type { Dashboard } from "@/lib/types";
import { fmt, valeurCommune } from "@/lib/analysis";
import { Card } from "../ui";

export function Sources({ data }: { data: Dashboard }) {
  const communes = Object.values(data.communes).sort((a, b) => b.population - a.population);
  const last = data.parc.annees.length - 1;
  const prixSP = data.prix.filter((p) => p.produit === "SP95").at(-1);
  return (
    <div className="space-y-4">
      <Card title="Sources officielles" subtitle="Récupérées automatiquement par pipeline/run.py, sauf les deux saisies manuelles publiées uniquement en PDF.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11.5px] uppercase tracking-wide text-muted">
              <tr><th className="py-2 pr-4">Donnée</th><th className="pr-4">Producteur</th><th className="pr-4">Millésime</th><th className="pr-4 text-right">Lignes</th><th className="pr-4">Récupérée le</th><th>Licence</th></tr>
            </thead>
            <tbody>
              {Object.entries(data.sources).map(([k, src]) => (
                <tr key={k} className="border-t border-line align-top">
                  <td className="py-2.5 pr-4"><a href={src.page} target="_blank" rel="noreferrer" className="font-medium underline decoration-line underline-offset-2 hover:decoration-ink">{src.label}</a></td>
                  <td className="pr-4 text-ink-2">{src.producer}</td>
                  <td className="tabular pr-4">{src.millesime ?? "—"}</td>
                  <td className="tabular pr-4 text-right">{fmt.n(src.lignes)}</td>
                  <td className="tabular pr-4 text-ink-2">{src.recupere_le ? new Date(src.recupere_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "saisie manuelle"}</td>
                  <td className="text-ink-2">{src.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {prixSP && (
          <p className="mt-3 text-[12.5px] text-ink-2">
            Dernier prix SP95 relevé : <strong>{fmt.eur(prixSP.prix)}</strong> ({prixSP.mois}, {prixSP.source}{prixSP.verifie ? "" : ", à vérifier sur l'arrêté"}). À mettre à jour dans <code>pipeline/manual/prix_prefecture.csv</code>.
          </p>
        )}
      </Card>
      <Card title="Données par commune" subtitle={`Vue tabulaire de la carte · parc au 1er janvier ${data.parc.annees[last]} · ménages et niveau de vie 2023`}>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-right text-[13px]">
            <thead className="text-[11.5px] uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3 text-left">Commune</th><th className="pr-3">Population</th><th className="pr-3">Densité</th>
                <th className="pr-3">Ménages motorisés</th><th className="pr-3">Niveau de vie médian</th><th className="pr-3">VP essence</th>
                <th className="pr-3">Part essence</th><th className="pr-3">Stations</th><th className="pr-3">Motos 10 ans</th><th>Canne (ha)</th>
              </tr>
            </thead>
            <tbody>
              {communes.map((c) => (
                <tr key={c.code} className="border-t border-line">
                  <td className="py-2 pr-3 text-left font-medium">{c.nom}</td>
                  <td className="pr-3">{fmt.n(c.population)}</td>
                  <td className="pr-3">{fmt.n(c.densite)}</td>
                  <td className="pr-3">{c.part_motorises != null ? fmt.pct(c.part_motorises) : "—"}</td>
                  <td className="pr-3">{c.niveau_vie_median != null ? `${fmt.n(c.niveau_vie_median)} €` : "—"}</td>
                  <td className="pr-3">{fmt.n(valeurCommune(data, c, "vp_essence", "tous", last))}</td>
                  <td className="pr-3">{fmt.n1(valeurCommune(data, c, "part_essence", "tous", last))} %</td>
                  <td className="pr-3">{c.stations}</td>
                  <td className="pr-3">{fmt.n(c.motos_10ans)}</td>
                  <td>{fmt.n(c.canne_ha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Méthode et limites">
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
          <li>Aucune source publique ne donne le nombre de véhicules pour lesquels le constructeur préconise le 98 : c&apos;est l&apos;hypothèse la plus sensible, que le questionnaire (médiane déclarée par les professionnels) vient remplacer.</li>
          <li>Les répondants au questionnaire ne sont pas un échantillon représentatif : leur intérêt pour le SP98 ou l&apos;E85 est probablement supérieur à la moyenne. La demande déclarée est donc un plafond.</li>
          <li>Les stations viennent de la BPE {data.sources.stations.millesime} (INSEE) : position fiable, mais sans enseigne ni volumes vendus.</li>
          <li>Le trafic est celui des routes nationales seulement ({data.tmja.annee}) ; les routes départementales ne sont pas couvertes.</li>
          <li>La surface en canne vient des déclarations PAC (RPG) : elle sous-estime légèrement la sole cannière totale.</li>
          <li>Les coûts d&apos;usine et de logistique sont des ordres de grandeur tirés d&apos;installations existantes (sources citées sous chaque curseur) ; seules la SRPP, les distributeurs et la filière peuvent les préciser.</li>
        </ul>
      </Card>
    </div>
  );
}
