// Envoi d'une photo ou d'un billet (corps brut, 4 Mo max). En-tête x-escale-id = identifiant du voyageur.
import { ID_RE, putFile, readBody, send, fail } from "./_lib.js";

export const config = { api: { bodyParser: false } };
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { error: "POST uniquement" }); }
    const id = String(req.headers["x-escale-id"] || "");
    if (!ID_RE.test(id)) return send(res, 400, { error: "Identifiant manquant" });
    const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    const ext = TYPES[type];
    if (!ext) return send(res, 415, { error: "Format non accepté (photo ou PDF)" });
    const buf = await readBody(req, 4_400_000);
    if (!buf.length) return send(res, 400, { error: "Fichier vide" });
    const r = await putFile(`escale/f/${id}/${Date.now().toString(36)}.${ext}`, buf, type);
    return send(res, 200, { url: r.url, type, size: buf.length });
  } catch (e) { return fail(res, e); }
}
