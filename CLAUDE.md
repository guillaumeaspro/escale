# Escale — carnet de voyage (nom provisoire)

Appli web publique qui accompagne tout le voyage : **avant** (préparer), **pendant** (sur place), **après** (souvenirs, carnet de route partagé façon Polarsteps).
Utilisable **sans compte et sans Claude** : hébergée sur Vercel (dépôt GitHub `guillaumeaspro/escale`, déploiement automatique depuis `main`).
Adresse en ligne : **https://escale-amber.vercel.app** (projet Vercel `escale`, compte Hobby `guillaumeaspro`). Stockage : Blob `escale-blob` (public, région Paris cdg1), variables `BLOB_READ_WRITE_TOKEN` et `BLOB_STORE_ID`. L'appli Vercel de GitHub n'a accès qu'à une liste de dépôts choisis : `escale` y a été ajouté le 18/11/2026.
Quotas Blob du plan gratuit à surveiller : environ 2 000 opérations avancées par mois (chaque sauvegarde d'un voyage et chaque republication d'un partage en direct en est une) ; si ça devient juste, espacer les sauvegardes ou regrouper les écritures.
Le propriétaire (Guillaume) n'utilise que Claude en version web : Claude fait le code, les mises en ligne et les mises à jour.
Prototype d'origine : artifact claude.ai `c1848a2b-d5ee-4eec-a59e-ab274f8f8ba5` (ancienne version, données propres à Claude).

## Fichiers
- `index.html` : toute l'appli (HTML + CSS + JS, aucune étape de build). Police Archivo (Google Fonts).
- `api/` (fonctions Vercel) :
  - `_lib.js` : stockage Vercel Blob (`ESCALE_FS=<dossier>` = stockage fichier pour les tests locaux).
  - `me.js` : `POST {op:get|put,id,secret,doc}` — les voyages d'une personne. Fichier `escale/u/<id>/<hash(secret)>.json` (adresse impossible à deviner sans le secret).
  - `upload.js` : photo ou billet en corps brut (4 Mo max, jpeg/png/webp/gif/heic/pdf), en-tête `x-escale-id` → URL publique Blob (`escale/f/<id>/…`).
  - `share.js` : voyages partagés `escale/s/<code>.json`. GET `?code=` public (sans le champ `owner`) ; POST put/delete réservé à l'auteur (`owner = hash(id:secret)`).
  - `ai.js` + `config.js` : « Compléter » une adresse, « Plus d'idées autour de moi » et **import de réservations** + recommandations (`kind:"around"` adresses autour d'un logement + sa position ; `kind:"tips"` conseils pour un trajet ; `kind:"booking"` : texte d'e-mail ≤ 20 000 caractères + jusqu'à 3 billets PDF/images déjà envoyés, relus uniquement depuis notre stockage Blob `escale/f/`) via l'API Claude, seulement si `ANTHROPIC_API_KEY` est définie (modèle `ESCALE_MODEL`, défaut `claude-sonnet-5-5`). Consignes construites côté serveur. Sans clé, l'appli masque ces boutons.
- `sw.js` : hors connexion (appli, billets/photos déjà vus, fond de carte). `manifest.webmanifest` + `icons/` : installable sur l'écran d'accueil.
- `countries-50m.json` (world-atlas 2.0.2) : compter les pays traversés (d3 + topojson chargés à la demande).
- `vercel.json` : `/v/<code>` → `index.html` (lien public d'un voyage).

## Interface (piste B « Carnet photo », choisie le 17/11/2026)
- Maquettes de référence : canvas Design « Escale — 3 pistes d'interface » (slug `d8cd1107-d1b5-4672-9581-a4c3df5d41c5`), piste B.
- Couleurs : blanc, bleu canard `#0F3D3E` (encre), jaune soleil `#FFC43D`, corail `#FF6A4D` (accent), fond doux `#F1F6F5`. Police Plus Jakarta Sans. Thème sombre automatique.
- Navigation : barre en bas `bottomNav()` — Voyage (programme + réservations), Aujourd'hui (jour J + What now), bouton central corail (feuille « Ajouter » : étape, adresse, réservation), Adresses, Carnet (carte + étapes / Noter / Récap). `S.tab` ∈ voyage|today|adresses|carnet.
- Chaque onglet s'ouvre sur une grande image (`.hero`) : photo de la journée (dernière photo d'étape ou d'adresse), sinon illustration générée (`coverSVG`) ; carte Leaflet en tête du Carnet et de la page partagée. Le contenu glisse par-dessus sur une feuille arrondie (`.sheet`). La pastille en haut à gauche ramène à la liste des voyages.

## Identité sans compte
- Au premier lancement : `id` (12) + `secret` (28) aléatoires dans `localStorage` (`escale.me`).
- Réglages → « code de récupération » `id-secret` pour retrouver ses voyages sur un autre appareil.
- Synchronisation : copie locale qui fait foi (`escale.trips.v1`, suppressions `escale.deleted.v1`), envoi 1,5 s après chaque modification, récupération à l'ouverture et au retour sur l'appli ; fusion voyage par voyage selon `updated`.

## Données
- Voyage : `{id,name,dest,start,end,places[],bookings[],steps[],dayCity{},dayNote{},shareCode,by,live,sharePhotos,updated}`.
- Adresse : `cat` resto|bar|boutique|visite|activite|autre, `status` envie|reserve, `date/time` (vide = wishlist), `lat/lng`, `dur`, `must`, souvenirs `visited, visitedOn, rating, fav, comment, photos[{url,…}]`.
- Réservation : `type` vol|train|bus|bateau|hotel|activite|location|autre, `title`, `from/to`, `date/time`, `endDate/endTime`, `city`, `address`, `ref`, `note`, `files[{url,name,type}]`, `imported` (lue automatiquement).
- Étape : `{id,name,lat,lng,date,time,text,photos[{url,name,type,lat,lng,taken}]}` — position/heure lues dans l'EXIF des photos (exifr), sinon GPS, lieu enregistré ou lien Maps.
- Partage : jamais les billets, références ni hôtels. En direct (`live`) : republié 2,5 s après chaque modification ; les lecteurs rechargent toutes les 30 s. « Voyages que tu suis » gardés dans `escale.follow`.

## Fonctions
- Import de réservations : « Importer » (accueil, onglet Réservations, menu +) → coller l'e-mail et/ou joindre PDF/capture → Claude extrait (un trajet = une réservation, hébergement = arrivée/départ) → écran de vérification (cases à cocher, choix du voyage : celui qui couvre les dates à ±2 jours, sinon nouveau voyage) → ajout avec le billet joint. Jamais de numéro de carte ni de mot de passe recopié.
- Après un import : conseils pratiques générés pour chaque vol/train/bus/bateau (`booking.tips`, visibles dans la fiche du billet, bouton « Conseils pratiques » sinon) ; pour un hébergement, fenêtre « Autour de ton logement » (8 idées, cochées → wishlist ; cache `booking.around` ; position du logement `geoApprox`). Bouton « Autour du logement » dans la fiche de l'hébergement.
- Carte jaune « À organiser » dans l'onglet Voyage (calcul local, sans IA) : nuits sans logement (sauf nuit de départ ou trajet de nuit), changement de ville entre deux logements sans trajet, pas de trajet retour.
- Programme jour par jour, réservations + billets (hors connexion), adresses avec filtres.
- « What now ? » : GPS (« Me localiser ») ou lieu choisi, temps dispo, envie → adresses enregistrées qui tiennent (marche 4,5 km/h ×1,3, sinon taxi), incontournables d'abord, radar SVG.
- Carnet de route : étapes photos + récit, carte Leaflet (fond CARTO Voyager / OpenStreetMap) avec photos en épingles, vols en pointillés courbes, km / pays / étapes / photos.
- Récap + lien public `/v/<code>` : carte, carnet, meilleures adresses, itinéraire réel ; « Partager ce voyage » (partage natif du téléphone) ; « Récupérer et adapter ».

## À faire ensuite
- Import par transfert d'e-mail (adresse perso type TripIt) : nom de domaine + service de réception d'e-mails → `api/inbound.js` qui réutilise l'extraction `booking`. Lecture directe de Gmail écartée (audit de sécurité Google obligatoire).
- Recommandations en temps réel : service de lieux (Google Places ou Foursquare) + Claude pour classer selon le contexte ; météo.
- Notifications aux abonnés quand une étape est publiée (modèle : Lucarne, `web-push`).
- Aperçu riche des liens partagés (titre/photo du voyage dans WhatsApp) : rendu serveur de `/v/<code>`.
- Limiter l'usage de `/api/ai` par appareil si l'appli s'ouvre largement.

## Tests locaux
`ESCALE_FS=/tmp/escale-fs` puis appeler les handlers de `api/` ; l'interface se teste avec jsdom en redirigeant `fetch` vers les handlers.
