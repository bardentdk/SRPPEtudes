"""Agrégation des réponses au questionnaire « Étude Carburants Réunion 2026 » (version 2).

Entrée : l'onglet « export » de la feuille de réponses, publié en CSV. Il ne contient
aucune colonne personnelle ni libre (voir questionnaire/creer-formulaire.gs, liste PERSONNEL).
Sortie : uniquement des comptages, des parts et des médianes. Toute répartition calculée
sur moins de SEUIL_K répondants est masquée (None), pour qu'un répondant ne soit pas reconnaissable.

Chaque public suit son propre parcours dans le formulaire : une même variable est donc
répartie sur plusieurs colonnes, repérées par le début de leur intitulé.
"""
import re
from datetime import datetime
from statistics import median

SEUIL_K = 3

GROUPES = {
    "Particulier": "part",
    "Concessionnaire automobile": "pro", "Concessionnaire moto": "pro", "Loueur de véhicules": "pro",
    "Garage, atelier ou préparateur": "pro", "Gestionnaire de flotte d'entreprise": "pro",
    "Club ou association automobile": "club", "Club ou association moto": "club",
    "Gérant de station-service": "station", "Distributeur ou réseau pétrolier": "station",
    "Acteur de la filière canne": "filiere",
}
PUBLICS = ("part", "pro", "club", "station", "filiere")
ACHAT = {"Oui, à chaque plein": "chaque", "Oui, la plupart": "chaque",
         "Oui, de temps en temps": "parfois", "Oui, une partie": "parfois", "Non": "non"}

# Début d'intitulé de chaque variable, par public.
COLONNES = {
    "horodatage": {"*": "Horodateur"},
    "profil": {"*": "Vous répondez en tant que"},
    "commune": {"*": "Commune principale"},
    "grille_sp98": {"part": "Achèteriez-vous du SP98", "pro": "Vos clients achèteraient-ils du SP98",
                    "club": "Vos membres achèteraient-ils du SP98"},
    "grille_e85": {"part": "Rouleriez-vous à l'E85", "pro": "Vos clients rouleraient-ils à l'E85",
                   "club": "Vos membres rouleraient-ils à l'E85"},
    "problemes": {"part": "Quels problèmes constatez-vous", "pro": "Quels problèmes vos clients",
                  "club": "Quels problèmes vos membres"},
    "zones": {"part": "Où les premières pompes SP98 vous", "pro": "Où les premières pompes SP98 seraient-elles le plus utiles à vos clients",
              "club": "Où les premières pompes SP98 seraient-elles le plus utiles à vos membres"},
    "connaissance_e85": {"part": "Connaissez-vous l'E85", "pro": "Vos clients connaissent-ils l'E85",
                         "club": "Vos membres connaissent-ils l'E85"},
    "engagement": {"part": "Accepteriez-vous de… (particulier)", "pro": "Accepteriez-vous de… (professionnel)",
                   "club": "Accepteriez-vous de… (club)", "station": "Accepteriez-vous de… (station)",
                   "filiere": "Accepteriez-vous de… (filière)"},
    # particuliers
    "vehicule": {"part": "Quel est votre véhicule principal"},
    "preconisation": {"part": "Quel carburant le constructeur préconise"},
    "litres": {"part": "Combien de litres de carburant"},
    "compat_e85": {"part": "Votre véhicule peut-il rouler à l'E85"},
    "budget_boitier": {"part": "Quel budget accepteriez-vous"},
    "local": {"part": "Quelle importance accordez-vous"},
    # professionnels et clubs
    "pro_volume": {"pro": "Combien de véhicules essence vendez-vous"},
    "pro_part98": {"pro": "Pour quelle part de ces véhicules"},
    "pro_flex": {"pro": "Combien de véhicules flex-fuel"},
    "pro_boitiers": {"pro": "Proposeriez-vous la pose de boîtiers"},
    "club_membres": {"club": "Combien de membres compte votre club"},
    "club_vehicules98": {"club": "Combien de véhicules de vos membres sont préconisés"},
    "club_flex": {"club": "Combien de véhicules de vos membres peuvent rouler"},
    # stations et distributeurs
    "st_nombre": {"station": "Combien de stations-service exploitez-vous"},
    "st_volume": {"station": "Quel volume d'essence vendez-vous"},
    "st_demande98": {"station": "Vos clients vous demandent-ils du SP98"},
    "st_cuve": {"station": "Disposez-vous d'une cuve"},
    "st_invest": {"station": "Quel investissement accepteriez-vous"},
    "st_marge": {"station": "Quelle marge de distribution"},
    "st_carburants": {"station": "Quel carburant envisageriez-vous"},
    "st_contraintes": {"station": "Quelles contraintes vous freineraient"},
    # filière canne
    "fi_type": {"filiere": "Vous êtes"},
    "fi_tonnage": {"filiere": "Quel tonnage de canne"},
    "fi_paille": {"filiere": "Quelle part de la paille"},
    "fi_prix_paille": {"filiere": "À quel prix céderiez-vous une tonne de paille"},
    "fi_melasse": {"filiere": "Quelle quantité de mélasse"},
    "fi_prix_melasse": {"filiere": "À quel prix céderiez-vous une tonne de mélasse"},
    "fi_role": {"filiere": "Quel rôle pourriez-vous jouer"},
    "fi_site": {"filiere": "Quel site vous semblerait"},
}

# Options des cases à cocher : certaines contiennent des virgules, on les repère par leur libellé exact.
OPTIONS = {
    "problemes": ["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation",
                  "Réserves sur la garantie constructeur", "Clients qui réclament du SP98", "Aucun problème"],
    "zones": ["Nord (Saint-Denis, Sainte-Marie)", "Ouest (Le Port, La Possession, Saint-Paul)",
              "Route des Tamarins / Saint-Leu", "Sud (Saint-Pierre, Le Tampon, Saint-Louis)",
              "Est (Saint-André, Saint-Benoît)", "Les Hauts"],
    "engagement": ["Signer une pétition de soutien", "Signer une lettre de soutien adressée à la SRPP et à la Préfecture",
                   "Relayer ce questionnaire", "Participer à une réunion de présentation", "Organiser une présentation au club",
                   "Accueillir une pompe pilote", "Recevoir les résultats de l'étude"],
    "st_carburants": ["SP98", "E85"],
    "st_contraintes": ["Place en cuve", "Coût d'investissement", "Approvisionnement en petits volumes",
                       "Réglementation et sécurité", "Demande trop faible"],
    "fi_role": ["Fournisseur de matière première", "Partenaire ou actionnaire", "Acheteur de coproduits", "Aucun"],
}

# Valeur représentative de chaque tranche (milieu, ou borne raisonnable pour les tranches ouvertes).
MILIEUX = {
    "litres": {"Moins de 40 L": 25, "40 à 79 L": 60, "80 à 149 L": 115, "150 L ou plus": 180},
    "pro_part98": {"Aucun": 0, "Moins de 5 %": 0.025, "5 à 10 %": 0.075, "10 à 25 %": 0.175, "25 à 50 %": 0.375,
                   "Plus de 50 %": 0.65},
    "st_volume": {"Moins de 500 m³": 300, "500 à 999 m³": 750, "1 000 à 2 999 m³": 2000, "3 000 à 9 999 m³": 6000,
                  "10 000 m³ ou plus": 15000},
    "st_invest": {"Aucun": 0, "Moins de 20 000 €": 10000, "20 000 à 49 999 €": 35000, "50 000 à 99 999 €": 75000,
                  "100 000 € ou plus": 125000},
    "st_marge": {"Moins de 0,05 €/L": 0.03, "0,05 à 0,09 €/L": 0.07, "0,10 à 0,14 €/L": 0.12, "0,15 €/L ou plus": 0.18},
    "fi_prix_paille": {"Moins de 30 €/t": 20, "30 à 49 €/t": 40, "50 à 79 €/t": 65, "80 €/t ou plus": 95},
    "fi_prix_melasse": {"Moins de 100 €/t": 80, "100 à 149 €/t": 125, "150 à 199 €/t": 175, "200 €/t ou plus": 225},
}
PALIER = re.compile(r"\[\+?(\d+),(\d+) €/L\]")


class Reponses:
    def __init__(self, lignes):
        self.lignes = lignes
        self.entetes = list(lignes[0].keys()) if lignes else []

    def colonnes(self, var, public="*"):
        debuts = COLONNES[var]
        debut = debuts.get(public) or debuts.get("*")
        return [h for h in self.entetes if debut and h.startswith(debut)]

    def valeurs(self, var, lignes, public="*"):
        cols = self.colonnes(var, public)
        return [l.get(cols[0], "") or "" for l in lignes] if cols else []


def _compte(valeurs):
    out = {}
    for v in valeurs:
        if v:
            out[v] = out.get(v, 0) + 1
    return out


def _coches(valeurs, options):
    return {o: sum(1 for v in valeurs if o in v) for o in options}


def _mediane(valeurs, milieux):
    nombres = [milieux[v] for v in valeurs if v in milieux]
    return round(median(nombres), 3) if len(nombres) >= SEUIL_K else None


def _grille(rep, var, public, lignes, poids=None):
    """Par palier : parts « chaque », « parfois », « non » (pondérées si poids est fourni)."""
    if len(lignes) < SEUIL_K:
        return None
    paliers = []
    for h in rep.colonnes(var, public):
        m = PALIER.search(h)
        if m:
            paliers.append((int(m.group(1)) + int(m.group(2)) / 10 ** len(m.group(2)), h))
    out = []
    for valeur, col in sorted(paliers):
        tot = {"chaque": 0.0, "parfois": 0.0, "non": 0.0}
        for i, l in enumerate(lignes):
            k = ACHAT.get(l.get(col, ""))
            if k:
                tot[k] += poids[i] if poids else 1
        n = sum(tot.values()) or 1
        out.append({"valeur": valeur, **{k: round(v / n, 3) for k, v in tot.items()}})
    return out


def _fusion(courbes):
    """Moyenne de plusieurs courbes (une par public), pondérée par leur nombre de répondants."""
    courbes = [(c, n) for c, n in courbes if c]
    if not courbes:
        return None
    total = sum(n for _, n in courbes)
    return [{"valeur": pts[0]["valeur"],
             **{k: round(sum(p[k] * n for p, (_, n) in zip(pts, courbes)) / total, 3) for k in ("chaque", "parfois", "non")}}
            for pts in zip(*[c for c, _ in courbes])]


def _bloc(lignes, contenu):
    """Détail d'un public rare (stations, filière) : masqué tant qu'il compte moins de SEUIL_K réponses."""
    return {"n": len(lignes), **(contenu() if len(lignes) >= SEUIL_K else {})}


def agreger(lignes, code_par_nom):
    if not lignes:
        return {"disponible": True, "reponses": 0, "seuil_k": SEUIL_K}
    rep = Reponses(lignes)
    profils = rep.valeurs("profil", lignes)
    par = {p: [l for l, pr in zip(lignes, profils) if GROUPES.get(pr) == p] for p in PUBLICS}
    v = lambda var, public: rep.valeurs(var, par[public], public)

    dates = []
    for d in rep.valeurs("horodatage", lignes):
        try:
            dates.append(datetime.strptime(d, "%d/%m/%Y %H:%M:%S"))
        except ValueError:
            pass

    communes = {}
    for nom, n in _compte(rep.valeurs("commune", lignes)).items():
        if code_par_nom.get(nom):
            communes[code_par_nom[nom]] = n

    litres = [MILIEUX["litres"].get(x, 0) for x in v("litres", "part")]
    courbes = {}
    for var in ("grille_sp98", "grille_e85"):
        par_public = {p: _grille(rep, var, p, par[p]) for p in ("part", "pro", "club")}
        courbes[var] = {
            "global": _fusion([(par_public[p], len(par[p])) for p in par_public]),
            "part_pondere": _grille(rep, var, "part", par["part"], poids=litres) if sum(litres) else None,
            "par_public": par_public,
        }

    def multi(var, publics):
        tous = []
        for p in publics:
            tous += v(var, p)
        return tous

    preco = v("preconisation", "part")
    nb_part = len(par["part"])
    local = [int(x) for x in v("local", "part") if x.strip().isdigit()]
    return {
        "disponible": True,
        "seuil_k": SEUIL_K,
        "reponses": len(lignes),
        "derniere_reponse": max(dates).isoformat() if dates else None,
        "profils": _compte(profils),
        "publics": {p: len(par[p]) for p in PUBLICS},
        "par_commune": communes,
        "prix_sp98": courbes["grille_sp98"],
        "prix_e85": courbes["grille_e85"],
        "eligibilite": {
            "part_sp98_uniquement": round(preco.count("SP98 uniquement") / nb_part, 3) if nb_part >= SEUIL_K else None,
            "part_sp98_possible": round((preco.count("SP98 uniquement") + preco.count("SP95 ou SP98")) / nb_part, 3)
            if nb_part >= SEUIL_K else None,
            "pros_part98_mediane": _mediane(v("pro_part98", "pro"), MILIEUX["pro_part98"]),
            "litres_mois_moyen": round(sum(litres) / len(litres)) if len(litres) >= SEUIL_K else None,
        },
        "problemes": _coches(multi("problemes", ("part", "pro", "club")), OPTIONS["problemes"]),
        "zones": _coches(multi("zones", ("part", "pro", "club")), OPTIONS["zones"]),
        "engagement": _coches(multi("engagement", PUBLICS), OPTIONS["engagement"]),
        "e85": {
            "connaissance": _compte(multi("connaissance_e85", ("part", "pro", "club"))),
            "compat_part": _compte(v("compat_e85", "part")),
            "budget_boitier": _compte(v("budget_boitier", "part")),
            "flex_pro": _compte(v("pro_flex", "pro")),
            "boitiers_pro": _compte(v("pro_boitiers", "pro")),
            "local_moyenne": round(sum(local) / len(local), 2) if len(local) >= SEUIL_K else None,
            "local_n": len(local),
        },
        "stations": _bloc(par["station"], lambda: {
            "volume_m3_median": _mediane(v("st_volume", "station"), MILIEUX["st_volume"]),
            "demande98": _compte(v("st_demande98", "station")),
            "cuve": _compte(v("st_cuve", "station")),
            "investissement_median": _mediane(v("st_invest", "station"), MILIEUX["st_invest"]),
            "marge_mediane": _mediane(v("st_marge", "station"), MILIEUX["st_marge"]),
            "carburants": _coches(v("st_carburants", "station"), OPTIONS["st_carburants"]),
            "contraintes": _coches(v("st_contraintes", "station"), OPTIONS["st_contraintes"]),
        }),
        "filiere": _bloc(par["filiere"], lambda: {
            "types": _compte(v("fi_type", "filiere")),
            "paille": _compte(v("fi_paille", "filiere")),
            "prix_paille_median": _mediane(v("fi_prix_paille", "filiere"), MILIEUX["fi_prix_paille"]),
            "melasse": _compte(v("fi_melasse", "filiere")),
            "prix_melasse_median": _mediane(v("fi_prix_melasse", "filiere"), MILIEUX["fi_prix_melasse"]),
            "roles": _coches(v("fi_role", "filiere"), OPTIONS["fi_role"]),
            "sites": _compte(v("fi_site", "filiere")),
        }),
    }
