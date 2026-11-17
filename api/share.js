// Voyages partagés par lien public /v/<code>.
// GET ?code=…  → le voyage (lisible par tous, sans compte)
// POST {op:"put", id, secret, code?, data} → crée ou met à jour (seul l'auteur peut modifier)
// POST {op:"delete", id, secret, code}     → arrête le partage
import crypto from "node:crypto";
import { ID_RE, SECRET_RE, CODE_RE, sharePath, ownerOf, readJSON, writeJSON, removeJSON, body, send, fail } from "./_lib.js";

const MAX = 1_500_000;
const newCode = () => [...crypto.randomBytes(7)].map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const code = String((req.query && req.query.code) || new URL(req.url, "http://x").searchParams.get("code") || "").toLowerCase();
      if (!CODE_RE.test(code)) return send(res, 400, { error: "Code invalide" });
      const d = await readJSON(sharePath(code));
      if (!d) return send(res, 404, { error: "Voyage introuvable" });
      const { owner, ...pub } = d;
      return send(res, 200, pub, "public, s-maxage=10, stale-while-revalidate=30");
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "Méthode non acceptée" }); }
    const { op, id, secret, code, data } = body(req);
    if (!ID_RE.test(id || "") || !SECRET_RE.test(secret || "")) return send(res, 400, { error: "Identifiant invalide" });
    const owner = ownerOf(id, secret);
    let existing = null;
    if (code) {
      if (!CODE_RE.test(code)) return send(res, 400, { error: "Code invalide" });
      existing = await readJSON(sharePath(code));
      if (existing && existing.owner !== owner) return send(res, 403, { error: "Ce voyage appartient à quelqu'un d'autre" });
    }
    if (op === "delete") { if (code) await removeJSON(sharePath(code)); return send(res, 200, { ok: true }); }
    if (op !== "put") return send(res, 400, { error: "Opération inconnue" });
    if (!data || !data.trip || typeof data.trip !== "object") return send(res, 400, { error: "Données invalides" });
    let c = code;
    if (!c) { for (let i = 0; i < 5 && !c; i++) { const k = newCode(); if (!(await readJSON(sharePath(k)))) c = k; } }
    if (!c) return send(res, 503, { error: "Réessaie dans un instant" });
    const now = Date.now();
    const doc = { code: c, by: String(data.by || "").slice(0, 40), live: !!data.live, created: (existing && existing.created) || now, updated: now, trip: data.trip, owner };
    if (JSON.stringify(doc).length > MAX) return send(res, 413, { error: "Voyage trop volumineux" });
    await writeJSON(sharePath(c), doc);
    return send(res, 200, { code: c, updated: now });
  } catch (e) { return fail(res, e); }
}
