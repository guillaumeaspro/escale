// Recherche d'adresses et de lieux (autocomplétion + position automatique), via Photon / OpenStreetMap.
// GET ?q=texte&lat=..&lon=.. (lat/lon facultatifs : favorisent les résultats proches du voyage)
// Réponses mises en cache 1 jour par Vercel pour rester sobre avec le service public Photon.
import { send, fail } from "./_lib.js";

const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };

export default async function handler(req, res) {
  try {
    const u = new URL(req.url, "http://x");
    const q = String(u.searchParams.get("q") || "").trim().slice(0, 200);
    if (q.length < 3) return send(res, 400, { error: "Tape au moins 3 caractères" });
    const lat = num(u.searchParams.get("lat")), lon = num(u.searchParams.get("lon"));
    const p = new URLSearchParams({ q, limit: "6", lang: "fr" });
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { p.set("lat", lat.toFixed(3)); p.set("lon", lon.toFixed(3)); }
    const r = await fetch("https://photon.komoot.io/api/?" + p, { headers: { "User-Agent": "Escale carnet de voyage (escale-amber.vercel.app)" } });
    if (!r.ok) return send(res, 502, { error: "Recherche indisponible" });
    const j = await r.json();
    const items = (j.features || []).map((f) => {
      const pr = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
      const street = [pr.housenumber, pr.street].filter(Boolean).join(" ");
      const city = pr.city || pr.town || pr.village || pr.county || "";
      const name = pr.name || street || city;
      const label = [pr.name && street ? street : "", pr.district || pr.locality || "", city, pr.country || ""].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i && x !== name).join(", ");
      return { name, label, address: [street, pr.postcode, city, pr.country].filter(Boolean).join(", "), city, area: pr.district || pr.locality || pr.suburb || "", country: pr.country || "", kind: pr.osm_value || "", lat: +(+c[1]).toFixed(6), lng: +(+c[0]).toFixed(6) };
    }).filter((x) => isFinite(x.lat) && isFinite(x.lng) && x.name);
    return send(res, 200, { items }, "public, s-maxage=86400, stale-while-revalidate=604800");
  } catch (e) { return fail(res, e); }
}
