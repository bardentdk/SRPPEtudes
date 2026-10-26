#!/usr/bin/env python3
"""Pipeline carburants La Réunion (SP98 importé, E85 local) : collecte des données
officielles, traitement et agrégation pour le tableau de bord Next.js.

Usage :
    python3 pipeline/run.py            # réutilise le cache s'il a moins de 24 h
    python3 pipeline/run.py --force    # retélécharge toutes les sources

Sorties :
    pipeline/.cache/*           copies brutes des sources (non versionnées)
    public/data/dashboard.json  données agrégées lues par l'application

Bibliothèque standard uniquement : aucune dépendance à installer.
"""
import argparse
import csv
import io
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".cache"
MANUAL = ROOT / "pipeline" / "manual"
OUT = ROOT / "public" / "data"
CACHE_TTL = 24 * 3600

DIDO = "https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles"
REGION = "https://data.regionreunion.com/api/explore/v2.1/catalog/datasets"
GEO = "https://geo.api.gouv.fr"
WFS = "https://data.geopf.fr/wfs/ows"
REUNION_BBOX = "55.18,-21.42,55.86,-20.85"
GRID_STEP = 0.01  # maille d'agrégation des parcelles de canne (~1 km)

SOURCES = {
    "communes": {
        "label": "Communes : contours, population légale, surface",
        "producer": "IGN / INSEE via geo.api.gouv.fr",
        "licence": "Licence Ouverte v2.0",
        "page": "https://geo.api.gouv.fr/decoupage-administratif/communes",
    },
    "parc": {
        "label": "Parc de véhicules au 1er janvier, par commune",
        "producer": "SDES, ministère de la Transition écologique",
        "licence": "Licence Ouverte v2.0",
        "page": "https://www.data.gouv.fr/datasets/689c430e4bdb87869ae1fce7/",
    },
    "immat": {
        "label": "Immatriculations de véhicules neufs, par commune",
        "producer": "SDES, ministère de la Transition écologique",
        "licence": "Licence Ouverte v2.0",
        "page": "https://www.data.gouv.fr/datasets/689c430d73e51e7e33250aea/",
    },
    "conso": {
        "label": "Consommation annuelle de produits pétroliers par DROM",
        "producer": "SDES, ministère de la Transition écologique",
        "licence": "Licence Ouverte v2.0",
        "page": "https://www.data.gouv.fr/datasets/689c42959e0f5fc8b8c1c2c6/",
    },
    "stations": {
        "label": "Stations-service géolocalisées (BPE, équipement B316)",
        "producer": "INSEE, via data.regionreunion.com",
        "licence": "Licence Ouverte v2.0",
        "page": "https://data.regionreunion.com/explore/dataset/base-permanente-des-equipements-geolocalisee-la-reunion/",
    },
    "tmja": {
        "label": "Trafic moyen journalier annuel sur les routes nationales",
        "producer": "Conseil régional de La Réunion, via data.regionreunion.com",
        "licence": "Licence Ouverte v1.0",
        "page": "https://data.regionreunion.com/explore/dataset/trafic-mja-rn-lareunion/",
    },
    "canne": {
        "label": "Parcelles déclarées en canne à sucre (RPG, code CSA)",
        "producer": "IGN / ASP, Registre parcellaire graphique, via data.geopf.fr",
        "licence": "Licence Ouverte v2.0",
        "page": "https://geoservices.ign.fr/rpg",
    },
    "sucrerie": {
        "label": "Usines sucrières et balances de réception de la canne",
        "producer": "Conseil régional de La Réunion, via data.regionreunion.com",
        "licence": "Licence Ouverte v1.0",
        "page": "https://data.regionreunion.com/explore/dataset/balances-canne-a-sucre-lareunion/",
    },
    "campagnes": {
        "label": "Tonnages des campagnes sucrières",
        "producer": "DAAF Réunion, notes de conjoncture (saisie manuelle depuis les PDF)",
        "licence": "Document administratif public",
        "page": "https://daaf.reunion.agriculture.gouv.fr",
    },
    "prix": {
        "label": "Prix maximums des carburants (arrêtés préfectoraux mensuels)",
        "producer": "Préfecture de La Réunion (saisie manuelle : publication en PDF uniquement)",
        "licence": "Document administratif public",
        "page": "https://www.reunion.gouv.fr",
    },
}


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def fetch(name, url, force):
    """Télécharge url dans le cache, sauf si la copie locale est récente."""
    path = CACHE / name
    if not force and path.exists() and time.time() - path.stat().st_mtime < CACHE_TTL:
        log(f"cache  {name}")
        return path.read_bytes()
    last_error = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "srpp-carburants-pipeline/1.0"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                body = resp.read()
            path.write_bytes(body)
            log(f"reçu   {name} ({len(body) / 1024:.0f} Ko)")
            return body
        except Exception as exc:  # réseau instable : on retente, puis on retombe sur le cache
            last_error = exc
            time.sleep(2 * (attempt + 1))
    if path.exists():
        log(f"échec  {name} ({last_error}), cache utilisé")
        return path.read_bytes()
    raise RuntimeError(f"{name} : {last_error}")


def read_csv(body, delimiter=";"):
    return list(csv.DictReader(io.StringIO(body.decode("utf-8-sig")), delimiter=delimiter))


def read_manual(name):
    with open(MANUAL / name, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def fuel_family(label):
    label = label.lower()
    if label.startswith("essence") or label == "hybride rechargeable":
        return "essence"  # les hybrides rechargeables du marché réunionnais sont quasi tous essence
    if label.startswith("diesel"):
        return "diesel"
    if label.startswith("electrique") or label.startswith("hydrog"):
        return "elec"
    return "autre"


def round_coords(coords, digits=4):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], digits), round(coords[1], digits)]
    out = [round_coords(c, digits) for c in coords]
    if out and isinstance(out[0][0], float):  # anneau : supprime les points devenus doublons
        out = [p for i, p in enumerate(out) if i == 0 or p != out[i - 1]]
    return out


def point_in_ring(x, y, ring):
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def polygons(geometry):
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


# --- Collecte -----------------------------------------------------------------

def fetch_cane_parcels(force):
    """Parcelles RPG en canne à sucre, paginées par 1 000 (≈ 7 000 parcelles, 11 Mo)."""
    cql = urllib.parse.quote(f"code_cultu='CSA' AND BBOX(geom,{REUNION_BBOX},'CRS:84')")
    base = (f"{WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=RPG.LATEST:parcelles_graphiques"
            f"&outputFormat=application/json&propertyName=geom,surf_parc&sortBy=num_parcel&CQL_FILTER={cql}")
    features, page = [], 0
    while True:
        chunk = json.loads(fetch(f"rpg_canne_{page}.json", f"{base}&count=1000&startIndex={page * 1000}", force))
        features += chunk["features"]
        if len(chunk["features"]) < 1000:
            return features
        page += 1


def collect(force):
    CACHE.mkdir(parents=True, exist_ok=True)
    communes = json.loads(fetch(
        "communes.geojson",
        f"{GEO}/departements/974/communes?fields=nom,code,population,surface,centre,contour"
        "&format=geojson&geometry=contour",
        force,
    ))
    codes = ",".join(f["properties"]["code"] for f in communes["features"])
    dido_args = f"csv?withColumnName=true&withColumnDescription=false&COMMUNE_CODE=in:{codes}"
    where = urllib.parse.quote('equipment_code="B316"')
    return {
        "communes": communes,
        "parc": read_csv(fetch("parc.csv", f"{DIDO}/1582861b-e042-4490-9161-6429d8229703/{dido_args}", force)),
        "immat": read_csv(fetch("immat_neuf.csv", f"{DIDO}/47354cb5-a501-446c-a4f7-1840d6e92f05/{dido_args}", force)),
        "conso": read_csv(fetch(
            "conso_drom.csv",
            f"{DIDO}/6c79805c-def9-4695-9d9f-7d86599c4d8a/csv?withColumnName=true&withColumnDescription=false",
            force,
        )),
        "stations": json.loads(fetch(
            "stations_bpe.json",
            f"{REGION}/base-permanente-des-equipements-geolocalisee-la-reunion/exports/json?where={where}",
            force,
        )),
        "tmja": json.loads(fetch("tmja_rn.json", f"{REGION}/trafic-mja-rn-lareunion/exports/json", force)),
        "sucrerie": json.loads(fetch("balances_canne.json", f"{REGION}/balances-canne-a-sucre-lareunion/exports/json", force)),
        "canne": fetch_cane_parcels(force),
        "campagnes": read_manual("campagnes_sucrieres.csv"),
        "prix": read_manual("prix_prefecture.csv"),
    }


# --- Traitement ---------------------------------------------------------------

def build_communes(raw):
    features, info = [], {}
    for f in raw["communes"]["features"]:
        p = f["properties"]
        area_km2 = (p.get("surface") or 0) / 100
        geom = f["geometry"]
        ring = polygons(geom)[0][0]
        info[p["code"]] = {
            "code": p["code"], "nom": p["nom"], "population": p["population"],
            "surface_km2": round(area_km2, 1),
            "densite": round(p["population"] / area_km2, 1) if area_km2 else 0,
            "centre": [round(sum(q[0] for q in ring) / len(ring), 4), round(sum(q[1] for q in ring) / len(ring), 4)],
        }
        features.append({"type": "Feature", "properties": {"code": p["code"], "nom": p["nom"]},
                         "geometry": {"type": geom["type"], "coordinates": round_coords(geom["coordinates"])}})
    return info, {"type": "FeatureCollection", "features": features}


def build_parc(raw, communes):
    """Parc VP par commune, année, famille de carburant et statut, plus l'essence Crit'Air 1."""
    years = sorted(int(k[5:]) for k in raw["parc"][0] if k.startswith("PARC_"))
    per_commune = {code: {fam: {"part": [0] * len(years), "pro": [0] * len(years)}
                          for fam in ("essence", "diesel", "elec", "autre", "essence_ca1")}
                   for code in communes}
    for row in raw["parc"]:
        if row["GROUPE"] != "VP" or row["COMMUNE_CODE"] not in per_commune:
            continue
        status = "part" if row["STATUT_UTILISATEUR"] == "Particulier" else "pro"
        fam = fuel_family(row["CARBURANT"])
        values = [to_int(row[f"PARC_{y}"]) for y in years]
        targets = [fam] + (["essence_ca1"] if fam == "essence" and row["CRIT_AIR"] == "Crit'Air 1" else [])
        for t in targets:
            series = per_commune[row["COMMUNE_CODE"]][t][status]
            for i, v in enumerate(values):
                series[i] += v
    return years, per_commune


def build_immat(raw, communes):
    years = sorted(int(k[6:]) for k in raw["immat"][0] if k.startswith("IMMAT_"))
    island = {k: [0] * len(years) for k in ("essence", "diesel", "elec", "autre", "moto", "cyclo")}
    motos_10y = {code: 0 for code in communes}
    recent = years[-10:]
    for row in raw["immat"]:
        if row["CATEGORIE"] == "MOTOCYCLETTE":
            key = "moto"
            if row["COMMUNE_CODE"] in motos_10y:
                motos_10y[row["COMMUNE_CODE"]] += sum(to_int(row[f"IMMAT_{y}"]) for y in recent)
        elif row["CATEGORIE"] == "CYCLOMOTEUR":
            key = "cyclo"
        elif row["GROUPE"] == "VP":
            key = fuel_family(row["CARBURANT"])
        else:
            continue
        for i, y in enumerate(years):
            island[key][i] += to_int(row[f"IMMAT_{y}"])
    return {"annees": years, "series": island, "periode_motos": f"{recent[0]}-{recent[-1]}"}, motos_10y


def build_conso(raw):
    by_dep = {}
    for r in sorted(raw["conso"], key=lambda r: (r["DEPARTEMENT_CODE"], r["ANNEE"])):
        dep = by_dep.setdefault(r["DEPARTEMENT_LIBELLE"], {"annees": [], "essence_m3": [], "gazole_m3": []})
        dep["annees"].append(int(r["ANNEE"]))
        dep["essence_m3"].append(to_int(r["ESSENCE_M3"]))
        dep["gazole_m3"].append(to_int(r["GAZOLE_M3"]))
    return by_dep


def build_tmja(raw):
    """Sections de RN de la dernière année de comptage, en polylignes [lat, lon]."""
    last_year = max(r["annee"] for r in raw["tmja"] if r.get("annee"))
    lines, history = [], {}
    for r in raw["tmja"]:
        if r.get("tmja") in (None, "NR") or not r.get("annee"):
            continue
        history.setdefault(r["annee"], []).append(to_int(r["tmja"]))
        shape = (r.get("geo_shape") or {}).get("geometry")
        if r["annee"] != last_year or not shape:
            continue
        parts = shape["coordinates"] if shape["type"] == "MultiLineString" else [shape["coordinates"]]
        for part in parts:
            lines.append({"route": r["route"], "tmja": to_int(r["tmja"]),
                          "coords": [[round(lat, 5), round(lon, 5)] for lon, lat in part]})
    # les années avec peu de points de comptage (ex. 2020) faussent la moyenne
    trend = [{"annee": y, "tmja_moyen": round(sum(v) / len(v))} for y, v in sorted(history.items()) if len(v) >= 30]
    return last_year, lines, trend


def dist_km(lat, lon, a, b):
    """Distance d'un point au segment [a, b] (coordonnées [lat, lon]), approximation plane."""
    kx, ky = 111.32 * math.cos(math.radians(lat)), 110.57
    px, py = lon * kx, lat * ky
    ax, ay, bx, by = a[1] * kx, a[0] * ky, b[1] * kx, b[0] * ky
    dx, dy = bx - ax, by - ay
    t = 0 if dx == dy == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def build_stations(raw, lines):
    stations = []
    for i, s in enumerate(raw["stations"]):
        pt = s.get("geo_point_2d")
        if not pt:
            continue
        lat, lon = pt["lat"], pt["lon"]
        best, best_tmja = 99.0, 0
        for line in lines:
            for a, b in zip(line["coords"], line["coords"][1:]):
                d = dist_km(lat, lon, a, b)
                if d < best:
                    best, best_tmja = d, line["tmja"]
        stations.append({
            "id": i, "lat": round(lat, 5), "lon": round(lon, 5),
            "commune": (s.get("com_arm_code") or [""])[0],
            "qualite": (s.get("geocode_quality") or [None])[0],
            "dist_rn_km": round(best, 2),
            "tmja_proche": best_tmja if best <= 0.5 else 0,  # trafic capté seulement à moins de 500 m d'une RN
        })
    return stations


def build_canne(raw, geo):
    """Surface en canne par commune et par maille, à partir du centroïde de chaque parcelle."""
    shapes = [(f["properties"]["code"], polygons(f["geometry"])) for f in geo["features"]]
    per_commune, grid, total = {}, {}, 0.0
    for parcel in raw["canne"]:
        ha = parcel["properties"].get("surf_parc") or 0
        ring = polygons(parcel["geometry"])[0][0]
        lon = sum(p[0] for p in ring) / len(ring)
        lat = sum(p[1] for p in ring) / len(ring)
        code = next((c for c, polys in shapes if any(point_in_ring(lon, lat, poly[0]) for poly in polys)), None)
        if code:
            per_commune[code] = per_commune.get(code, 0) + ha
        cell = (math.floor(lat / GRID_STEP), math.floor(lon / GRID_STEP))
        grid[cell] = grid.get(cell, 0) + ha
        total += ha
    cells = [{"lat": round((i + 0.5) * GRID_STEP, 4), "lon": round((j + 0.5) * GRID_STEP, 4), "ha": round(ha, 1)}
             for (i, j), ha in grid.items()]
    return {"parcelles": len(raw["canne"]), "surface_ha": round(total), "pas_maille_deg": GRID_STEP,
            "par_commune": {k: round(v, 1) for k, v in per_commune.items()}, "mailles": cells}


def build_sucrerie(raw):
    return [{"nom": s["nom"], "type": "usine" if s["type"] == "Usine" else "balance",
             "lat": round(s["geo_point_2d"]["lat"], 5), "lon": round(s["geo_point_2d"]["lon"], 5)}
            for s in raw["sucrerie"] if s.get("geo_point_2d")]


def run(force=False):
    started = time.time()
    raw = collect(force)
    communes, geo = build_communes(raw)
    years, parc = build_parc(raw, communes)
    immat, motos_10y = build_immat(raw, communes)
    tmja_year, lines, tmja_trend = build_tmja(raw)
    stations = build_stations(raw, lines)
    canne = build_canne(raw, geo)

    for code, c in communes.items():
        c["stations"] = sum(1 for s in stations if s["commune"] == code)
        c["motos_10ans"] = motos_10y[code]
        c["canne_ha"] = canne["par_commune"].get(code, 0)

    meta = {}
    files = {"communes": ["communes.geojson"], "parc": ["parc.csv"], "immat": ["immat_neuf.csv"],
             "conso": ["conso_drom.csv"], "stations": ["stations_bpe.json"], "tmja": ["tmja_rn.json"],
             "sucrerie": ["balances_canne.json"], "canne": ["rpg_canne_0.json"]}
    sizes = {"communes": len(communes), "parc": len(raw["parc"]), "immat": len(raw["immat"]),
             "conso": len(raw["conso"]), "stations": len(stations), "tmja": len(raw["tmja"]),
             "sucrerie": len(raw["sucrerie"]), "canne": len(raw["canne"]),
             "campagnes": len(raw["campagnes"]), "prix": len(raw["prix"])}
    for key, src in SOURCES.items():
        entry = dict(src, lignes=sizes[key], recupere_le=None)
        if key in files:
            mtime = (CACHE / files[key][0]).stat().st_mtime
            entry["recupere_le"] = datetime.fromtimestamp(mtime, timezone.utc).isoformat(timespec="minutes")
        meta[key] = entry
    meta["stations"]["millesime"] = raw["stations"][0].get("year") if raw["stations"] else None
    meta["tmja"]["millesime"] = tmja_year
    meta["parc"]["millesime"] = years[-1]
    meta["immat"]["millesime"] = immat["annees"][-1]

    out = {
        "genere_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "communes": communes,
        "geo": geo,
        "parc": {"annees": years, "par_commune": parc},
        "immat": immat,
        "conso": build_conso(raw),
        "stations": stations,
        "tmja": {"annee": tmja_year, "sections": lines, "tendance": tmja_trend},
        "canne": canne,
        "sucrerie": build_sucrerie(raw),
        "campagnes": [{"annee": int(r["annee"]), "tonnes": int(r["tonnes_cannes"]),
                       "richesse": float(r["richesse_pct"]) if r["richesse_pct"] else None,
                       "source": r["source"]} for r in raw["campagnes"]],
        "prix": [{"mois": r["mois"], "produit": r["produit"], "prix": float(r["prix_max_eur_l"]),
                  "source": r["source"], "verifie": r["verifie"] == "oui"} for r in raw["prix"]],
        "sources": meta,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    (OUT / "dashboard.json").write_text(payload, encoding="utf-8")
    log(f"terminé en {time.time() - started:.1f} s : {len(stations)} stations, {canne['parcelles']} parcelles "
        f"de canne, dashboard.json {len(payload) / 1024:.0f} Ko")
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="ignore le cache et retélécharge tout")
    args = parser.parse_args()
    try:
        run(force=args.force)
    except Exception as exc:
        log(f"ERREUR : {exc}")
        sys.exit(1)
