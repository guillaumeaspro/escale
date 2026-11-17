// Service worker d'Escale : appli disponible hors connexion (billets, photos et voyages déjà ouverts).
const V = "escale-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET") return;
  // Fichiers envoyés (billets, photos) : jamais modifiés → cache d'abord, pour les avoir sans réseau
  if (/\.blob\.vercel-storage\.com$/.test(u.hostname) && u.pathname.startsWith("/escale/f/")) {
    e.respondWith(caches.open(V).then((c) => c.match(req).then((h) => h || fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }))));
    return;
  }
  // Fond de carte et bibliothèques : cache puis réseau
  if (/basemaps\.cartocdn\.com$|unpkg\.com$|cdn\.jsdelivr\.net$|fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(V).then((c) => c.match(req).then((h) => { const f = fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => h); return h || f; })));
    return;
  }
  if (u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  // Pages de l'appli : réseau d'abord (mises à jour), cache si hors connexion ; /v/… renvoie l'appli
  e.respondWith(fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(V).then((x) => x.put(req, c)); } return r; })
    .catch(() => caches.match(req).then((h) => h || caches.match("/"))));
});
