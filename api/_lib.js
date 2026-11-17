// Outils partagés par les fonctions d'Escale (les fichiers commençant par « _ » ne sont pas des routes).
// Stockage : Vercel Blob. En test local, ESCALE_FS=<dossier> remplace Blob par des fichiers.
import { put, del } from "@vercel/blob";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const FSDIR = process.env.ESCALE_FS;
export const ID_RE = /^[a-z0-9]{8,40}$/;
export const SECRET_RE = /^[a-z0-9]{16,64}$/;
export const CODE_RE = /^[a-z0-9]{6,12}$/;
export const hash = (s) => crypto.createHash("sha256").update("escale:" + s).digest("hex");

// Le fichier d'un voyageur a une adresse dérivée de son secret : impossible à deviner sans son code.
export const userPath = (id, secret) => `escale/u/${id}/${hash("path:" + secret).slice(0, 32)}.json`;
export const sharePath = (code) => `escale/s/${code}.json`;
export const ownerOf = (id, secret) => hash("owner:" + id + ":" + secret);

function base() {
  const fromEnv = (process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  const fromToken = (process.env.BLOB_READ_WRITE_TOKEN || "").split("_")[3];
  const storeId = fromEnv || fromToken;
  if (!storeId) throw new Error("Stockage non configuré : reliez un stockage Blob au projet Vercel.");
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/`;
}

export async function readJSON(p) {
  if (FSDIR) { try { return JSON.parse(await fs.readFile(path.join(FSDIR, p), "utf8")); } catch (_) { return null; } }
  const r = await fetch(base() + p + "?v=" + Date.now(), { cache: "no-store" });
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error("Lecture impossible " + r.status);
  return r.json();
}
export async function writeJSON(p, obj) {
  const body = JSON.stringify(obj);
  if (FSDIR) { const f = path.join(FSDIR, p); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, body); return; }
  await put(p, body, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
}
export async function removeJSON(p) {
  if (FSDIR) { try { await fs.unlink(path.join(FSDIR, p)); } catch (_) {} return; }
  try { await del(base() + p); } catch (_) {}
}
export async function putFile(p, buf, type) {
  if (FSDIR) { const f = path.join(FSDIR, p); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, buf); return { url: "/__fs/" + p }; }
  const r = await put(p, buf, { access: "public", addRandomSuffix: true, contentType: type, cacheControlMaxAge: 31536000 });
  return { url: r.url };
}

export async function readBody(req, max) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) { const e = new Error("Fichier trop lourd (4 Mo maximum)"); e.status = 413; throw e; } chunks.push(c); }
  return Buffer.concat(chunks);
}
export function body(req) { return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; }
export function send(res, code, obj, cache) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(obj));
}
export const fail = (res, e) => send(res, e.status || 500, { error: String((e && e.message) || e) });
