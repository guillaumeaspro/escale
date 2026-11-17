// Fonctions IA (Claude) : « Compléter » une adresse et « Plus d'idées autour de moi ».
// Nécessite la variable ANTHROPIC_API_KEY dans Vercel. Modèle : ESCALE_MODEL (sinon claude-sonnet-5-5).
// Les consignes sont construites ici (pas par l'appli) pour que la clé ne serve qu'à Escale.
import { ID_RE, body, send, fail } from "./_lib.js";

const s = (v, n = 120) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").slice(0, n);
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const KINDS = { all: "lieux à faire (mélange de cafés, restos, visites, balades)", resto: "restaurants ou bons stands de street food", bar: "bars", visite: "visites", activite: "activités", boutique: "boutiques ou marchés" };

function prompt(b) {
  if (b.kind === "enrich") {
    return `Tu aides une appli de carnet de voyage. Lieu recherché : "${s(b.name)}"${b.city ? " à " + s(b.city, 60) : ""}. Voyage : ${s(b.dest, 100)}.
Réponds uniquement par un objet JSON : {"found":true|false,"name":"nom officiel court","cat":"resto|bar|boutique|visite|activite|autre","city":"ville","area":"quartier","lat":nombre,"lng":nombre,"dur":minutes typiques passées sur place,"note":"une phrase utile en français (horaires habituels, conseil, réservation)"}.
Si tu n'es pas sûr de connaître ce lieu précis, mets found=false, lat et lng à null.`;
  }
  if (b.kind === "nearby") {
    const lat = num(b.lat), lng = num(b.lng);
    if (lat == null || lng == null) return null;
    const exclude = (Array.isArray(b.exclude) ? b.exclude : []).slice(0, 60).map((x) => s(x, 60)).join(", ");
    return `Je suis en voyage, position actuelle : ${lat.toFixed(5)}, ${lng.toFixed(5)} (${s(b.city, 80)}). Il est ${s(b.time, 40)} heure locale. J'ai ${Math.round(num(b.mins) || 60)} minutes devant moi.
Préférences : ${s(b.prefs, 200) || "aucune"}.
Propose 5 ${KINDS[b.want] || KINDS.all} réels et connus, habituellement ouverts à ce moment, à moins de 20 minutes à pied si possible. Exclus : ${exclude || "rien"}.
Réponds uniquement en JSON : {"items":[{"name":"","cat":"resto|bar|boutique|visite|activite|autre","area":"quartier","lat":nombre,"lng":nombre,"why":"une phrase en français"}]}. N'invente pas de lieu : si tu n'es pas sûr, propose-en moins.`;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "POST uniquement" });
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return send(res, 501, { error: "IA non configurée" });
    const b = body(req);
    if (!ID_RE.test(b.id || "")) return send(res, 400, { error: "Identifiant manquant" });
    const p = prompt(b);
    if (!p) return send(res, 400, { error: "Demande invalide" });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ESCALE_MODEL || "claude-sonnet-5-5", max_tokens: 1200, messages: [{ role: "user", content: p }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, r.status === 429 ? 429 : 502, { error: (j.error && j.error.message) || "IA indisponible" });
    const text = (j.content || []).map((c) => c.text || "").join("");
    const m = text.match(/\{[\s\S]*\}/);
    let out = null; try { out = m ? JSON.parse(m[0]) : null; } catch (_) {}
    if (!out) return send(res, 502, { error: "Réponse illisible" });
    return send(res, 200, { json: out });
  } catch (e) { return fail(res, e); }
}
