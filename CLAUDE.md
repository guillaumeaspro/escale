# Escale — carnet de voyage (nom provisoire)

Appli web publique qui accompagne tout le voyage : **avant** (préparer), **pendant** (sur place), **après** (souvenirs, carnet de route partagé façon Polarsteps).
Utilisable **sans compte et sans Claude** : hébergée sur Vercel (dépôt GitHub `guillaumeaspro/escale`, déploiement automatique depuis `main`).
Le propriétaire (Guillaume) n'utilise que Claude en version web : Claude fait le code, les mises en ligne et les mises à jour.
Prototype d'origine : artifact claude.ai `c1848a2b-d5ee-4eec-a59e-ab274f8f8ba5` (ancienne version, données propres à Claude).

## Fichiers
- `index.html` : toute l'appli (HTML + CSS + JS, aucune étape de build). Police Archivo (Google Fonts).
- `api/` (fonctions Vercel) :
  - `_lib.js` : stockage Vercel Blob (`ESCALE_FS=<dossier>` = stockage fichier pour les tests locaux).
  - `me.js` : `POST {op:get|put,id,secret,doc}` — les voyages d'une personne. Fichier `escale/u/<id>/<hash(secret)>.json` (adresse impossible à deviner sans le secret).
  - `upload.js` : photo ou billet en corps brut (4 Mo max, jpeg/png/webp/gif/heic/pdf), en-tête `x-escale-id` → URL publique Blob (`escale/f/<id>/…`).
  - `share.js` : voyages partagés `escale/s/<code>.json`. GET `?code=` public (sans le champ `owner`) ; POST put/delete réservé à l'auteur (`owner = hash(id:secret)`).
  - `ai.js` + `config.js` : « Compléter » une adresse et « Plus d'idées autour de moi » via l'API Claude, seulement si `ANTHROPIC_API_KEY` est définie (modèle `ESCALE_MODEL`, défaut `claude-sonnet-5-5`). Consignes construites côté serveur. Sans clé, l'appli masque ces boutons.
- `sw.js` : hors connexion (appli, billets/photos déjà vus, fond de carte). `manifest.webmanifest` + `icons/` : installable sur l'écran d'accueil.
- `countries-50m.json` (world-atlas 2.0.2) : compter les pays traversés (d3 + topojson chargés à la demande).
- `vercel.json` : `/v/<code>` → `index.html` (lien public d'un voyage).

## Identité sans compte
- Au premier lancement : `id` (12) + `secret` (28) aléatoires dans `localStorage` (`escale.me`).
- Réglages → « code de récupération » `id-secret` pour retrouver ses voyages sur un autre appareil.
- Synchronisation : copie locale qui fait foi (`escale.trips.v1`, suppressions `escale.deleted.v1`), envoi 1,5 s après chaque modification, récupération à l'ouverture et au retour sur l'appli ; fusion voyage par voyage selon `updated`.

## Données
- Voyage : `{id,name,dest,start,end,places[],bookings[],steps[],dayCity{},dayNote{},shareCode,by,live,sharePhotos,updated}`.
- Adresse : `cat` resto|bar|boutique|visite|activite|autre, `status` envie|reserve, `date/time` (vide = wishlist), `lat/lng`, `dur`, `must`, souvenirs `visited, visitedOn, rating, fav, comment, photos[{url,…}]`.
- Réservation : `type` vol|train|bus|bateau|hotel|activite|location|autre, `from/to`, `date/time`, `endDate`, `city`, `ref`, `files[{url,name,type}]`.
- Étape : `{id,name,lat,lng,date,time,text,photos[{url,name,type,lat,lng,taken}]}` — position/heure lues dans l'EXIF des photos (exifr), sinon GPS, lieu enregistré ou lien Maps.
- Partage : jamais les billets, références ni hôtels. En direct (`live`) : republié 2,5 s après chaque modification ; les lecteurs rechargent toutes les 30 s. « Voyages que tu suis » gardés dans `escale.follow`.

## Fonctions
- Programme jour par jour, réservations + billets (hors connexion), adresses avec filtres.
- « What now ? » : GPS (« Me localiser ») ou lieu choisi, temps dispo, envie → adresses enregistrées qui tiennent (marche 4,5 km/h ×1,3, sinon taxi), incontournables d'abord, radar SVG.
- Carnet de route : étapes photos + récit, carte Leaflet (fond CARTO Voyager / OpenStreetMap) avec photos en épingles, vols en pointillés courbes, km / pays / étapes / photos.
- Récap + lien public `/v/<code>` : carte, carnet, meilleures adresses, itinéraire réel ; « Partager ce voyage » (partage natif du téléphone) ; « Récupérer et adapter ».

## À faire ensuite
- Recommandations en temps réel : service de lieux (Google Places ou Foursquare) + Claude pour classer selon le contexte ; météo.
- Notifications aux abonnés quand une étape est publiée (modèle : Lucarne, `web-push`).
- Aperçu riche des liens partagés (titre/photo du voyage dans WhatsApp) : rendu serveur de `/v/<code>`.
- Limiter l'usage de `/api/ai` par appareil si l'appli s'ouvre largement.

## Tests locaux
`ESCALE_FS=/tmp/escale-fs` puis appeler les handlers de `api/` ; l'interface se teste avec jsdom en redirigeant `fetch` vers les handlers.
