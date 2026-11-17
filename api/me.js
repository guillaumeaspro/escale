// Sauvegarde des voyages d'une personne, sans compte : identifiant + secret générés sur son téléphone.
// POST {op:"get"|"put", id, secret, doc?}
import { ID_RE, SECRET_RE, userPath, readJSON, writeJSON, body, send, fail } from "./_lib.js";

const MAX = 3_000_000;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "POST uniquement" }); }
    const { op, id, secret, doc } = body(req);
    if (!ID_RE.test(id || "") || !SECRET_RE.test(secret || "")) return send(res, 400, { error: "Code de récupération invalide" });
    const p = userPath(id, secret);
    if (op === "get") {
      const d = await readJSON(p);
      return d ? send(res, 200, { doc: d }) : send(res, 404, { error: "Aucun voyage pour ce code" });
    }
    if (op === "put") {
      if (!doc || typeof doc.trips !== "object" || Array.isArray(doc.trips)) return send(res, 400, { error: "Données invalides" });
      const out = { trips: doc.trips, deleted: doc.deleted && typeof doc.deleted === "object" ? doc.deleted : {}, u: Date.now() };
      if (JSON.stringify(out).length > MAX) return send(res, 413, { error: "Trop de données" });
      await writeJSON(p, out);
      return send(res, 200, { ok: true, u: out.u });
    }
    return send(res, 400, { error: "Opération inconnue" });
  } catch (e) { return fail(res, e); }
}
