"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, GeoJSON, MapContainer, Pane, Polyline, Rectangle, Tooltip } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import type { Feature } from "geojson";
import type { Dashboard } from "@/lib/types";
import { fmt } from "@/lib/analysis";
import type { Tokens } from "./useTokens";
import { couleur, seuils, type Couches, type StationClassee } from "@/lib/carto";

// Chaque couche a son plan : avec le rendu canvas, l'ordre d'ajout décide sinon de l'empilement,
// et une couche recréée (changement de filtre) repasserait au-dessus des autres.
const PLANS = { communes: 410, canne: 420, cote: 430, trafic: 440, rayon: 445, points: 450 } as const;

export interface Rayon { lat: number; lon: number; km: number; label: string }

export default function MapView({ data, valeurs, unite, libelle, couches, classement, pilotes: listePilotes, tokens, dark, selection, onSelect, rayon }: {
  data: Dashboard;
  valeurs: Record<string, number>;
  unite: string;
  libelle: string;
  couches: Couches;
  classement: StationClassee[];
  pilotes: StationClassee[];
  tokens: Tokens;
  dark: boolean;
  selection: string | null;
  onSelect: (code: string | null) => void;
  rayon?: Rayon | null;
}) {
  const s = seuils(Object.values(valeurs));
  const maxHa = Math.max(...data.canne.mailles.map((m) => m.ha));
  const half = data.canne.pas_maille_deg / 2;
  const pilotes = new Map(listePilotes.map((st, i) => [st.id, i + 1]));

  const style = (f?: Feature): PathOptions => {
    const code = (f?.properties as { code: string }).code;
    const choisie = selection === code;
    return {
      fillColor: couches.communes ? couleur(valeurs[code] ?? 0, s) : tokens.land,
      fillOpacity: couches.communes ? 0.85 : 1,
      color: tokens.ink,
      opacity: choisie ? 0.9 : 0.22,
      weight: choisie ? 2.5 : 0.8,
    };
  };

  const onEach = (f: Feature, layer: Layer) => {
    const p = f.properties as { code: string; nom: string };
    const c = data.communes[p.code];
    layer.bindTooltip(
      `<strong>${p.nom}</strong><br/>${libelle} : <strong>${fmt.n1(valeurs[p.code] ?? 0)}</strong> ${unite}` +
        `<br/><span style="color:${tokens.muted}">${fmt.n(c.population)} hab. · ${c.stations} station(s) · ${fmt.n(c.canne_ha)} ha de canne</span>`,
      { sticky: true },
    );
    layer.on("click", () => onSelect(selection === p.code ? null : p.code));
  };

  return (
    <MapContainer
      center={[-21.115, 55.536]}
      zoom={10}
      minZoom={9}
      maxBounds={[[-21.6, 54.9], [-20.6, 56.1]]}
      preferCanvas
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "var(--sea)" }} // leaflet.css impose #ddd ; la variable suit le thème sans re-rendu
      attributionControl
    >
      <Pane name="communes" style={{ zIndex: PLANS.communes }}>
        <GeoJSON
          key={`${libelle}-${JSON.stringify(s)}-${couches.communes}-${selection}-${dark}`}
          data={data.geo}
          style={style}
          onEachFeature={onEach}
        />
      </Pane>

      <Pane name="canne" style={{ zIndex: PLANS.canne }}>
        {couches.canne &&
          data.canne.mailles.map((m) => (
            <Rectangle
              key={`${m.lat}-${m.lon}`}
              bounds={[[m.lat - half, m.lon - half], [m.lat + half, m.lon + half]]}
              pathOptions={{ stroke: false, fillColor: tokens.s2, fillOpacity: 0.25 + 0.7 * (m.ha / maxHa) }}
            >
              <Tooltip>{fmt.n1(m.ha)} ha de canne déclarés dans la maille</Tooltip>
            </Rectangle>
          ))}
      </Pane>

      <Pane name="cote" style={{ zIndex: PLANS.cote, pointerEvents: "none" }}>
        {data.contour.map((ligne, i) => (
          <Polyline key={`${i}-${dark}`} positions={ligne} interactive={false}
            pathOptions={{ color: tokens.ink, weight: 2, opacity: 0.85, lineJoin: "round" }} />
        ))}
      </Pane>

      <Pane name="trafic" style={{ zIndex: PLANS.trafic }}>
        {couches.trafic &&
          data.tmja.sections.map((l, i) => (
            <Polyline
              key={i}
              positions={l.coords}
              pathOptions={{ color: tokens.ink2, weight: 1 + l.tmja / 18000, opacity: 0.8, lineCap: "round" }}
            >
              <Tooltip sticky>
                {l.route} · <strong>{fmt.n(l.tmja)}</strong> véh./jour ({data.tmja.annee})
              </Tooltip>
            </Polyline>
          ))}
      </Pane>

      <Pane name="rayon" style={{ zIndex: PLANS.rayon }}>
        {rayon && (
          <Circle center={[rayon.lat, rayon.lon]} radius={rayon.km * 1000} interactive={false}
            pathOptions={{ color: tokens.s3, weight: 2, dashArray: "6 6", fillColor: tokens.s3, fillOpacity: 0.08 }}>
            <Tooltip permanent direction="top">{rayon.label}</Tooltip>
          </Circle>
        )}
      </Pane>

      <Pane name="points" style={{ zIndex: PLANS.points }}>
        {couches.sucrerie &&
          data.sucrerie.map((u) => (
            <CircleMarker
              key={u.nom}
              center={[u.lat, u.lon]}
              radius={u.type === "usine" ? 9 : 5}
              pathOptions={{ color: tokens.surface, weight: 2, fillColor: tokens.s3, fillOpacity: u.type === "usine" ? 1 : 0.85 }}
            >
              <Tooltip>
                <strong>{u.nom}</strong>
                <br />
                {u.type === "usine" ? "Usine sucrière (centrale bagasse attenante)" : "Balance de réception de la canne"}
              </Tooltip>
            </CircleMarker>
          ))}
        {couches.stations &&
          [...classement].reverse().map((st) => {
            const rang = pilotes.get(st.id);
            return (
              <CircleMarker
                key={st.id}
                center={[st.lat, st.lon]}
                radius={rang ? 8 : 4}
                pathOptions={{
                  color: rang ? tokens.surface : tokens.ink,
                  weight: rang ? 2 : 0.8,
                  fillColor: rang ? tokens.s1 : tokens.muted,
                  fillOpacity: 1,
                }}
              >
                <Tooltip>
                  <strong>{rang ? `Pilote n° ${rang} · ` : ""}Station · {st.nom}</strong>
                  <br />
                  Score {st.score}/100 · {st.tmja_proche ? `${fmt.n(st.tmja_proche)} véh./j à ${fmt.n1(st.dist_rn_km * 1000)} m` : `RN à ${fmt.n1(st.dist_rn_km)} km`}
                </Tooltip>
              </CircleMarker>
            );
          })}
      </Pane>
    </MapContainer>
  );
}
