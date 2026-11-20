// Service worker d'Escale : appli disponible hors connexion (billets, photos et voyages déjà ouverts).
const V = "escale-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, u = new URL(req.url);
  // Réception d'un partage depuis une autre appli (Android, Escale installée) : on garde le texte et les fichiers, puis on ouvre l'import.
  if (req.method === "POST" && u.origin === location.origin && u.pathname === "/share") {
    e.respondWith((async () => {
      try {
        const fd = await req.formData(), c = await caches.open("escale-share");
        const text = [fd.get("title"), fd.get("text"), fd.get("url")].filter(Boolean).join("\n");
        await c.put("/__share/text", new Response(text));
        let i = 0;
        for (const f of fd.getAll("files")) { if (f && f.size) await c.put("/__share/file" + i++, new Response(f, { headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name || "billet") } })); }
      } catch (_) {}
      return Response.redirect("/?share=1", 303);
    })());
    return;
  }
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
