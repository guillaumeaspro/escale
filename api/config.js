// Ce que le serveur sait faire (l'appli masque les fonctions IA si aucune clé n'est configurée).
import { send } from "./_lib.js";
export default function handler(req, res) {
  return send(res, 200, { ai: !!process.env.ANTHROPIC_API_KEY }, "public, s-maxage=300");
}
