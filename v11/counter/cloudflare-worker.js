// Счётчик реальных расчётов «Цель миллион» на Cloudflare Workers + D1 (бесплатный тариф).
// Два способа подключения (см. README.md):
//   1) workers.dev: https://million-counter.<поддомен>.workers.dev/api/million/… — DNS сайта не трогаем,
//      в index.html: var COUNTER_URL = "https://million-counter.<поддомен>.workers.dev/api/million";
//   2) маршрут на своём домене ВАШ-ДОМЕН/api/million/* (запись сайта в Cloudflare с «оранжевым облаком»),
//      в index.html: var COUNTER_URL = "/api/million";
// GET  /api/million/stats  → {"total": 128, "recent": [{"m": 7500, "t": 1791234567890}, …]}
// POST /api/million/event  {"m": 7500, "how": "calc" | "pdf"} — человек сам рассчитал план или скачал PDF
// Хранится только сумма взноса (округлённая до 500 ₽) и время. Адрес посетителя не хранится:
// для защиты от накрутки держим его солёный хеш 10 минут и удаляем.
// ALLOW_ORIGIN — с каких сайтов можно обращаться, через запятую (например "https://million.gazfond-pn.com").

const BASE = "/api/million";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    const allow = (env.ALLOW_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
    const sameHost = origin && new URL(origin).host === url.host;
    const okOrigin = !origin || sameHost || allow.includes(origin);
    const cors = okOrigin && origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" } : {};
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });

    if (req.method === "OPTIONS") return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (!url.pathname.startsWith(BASE)) return json({ error: "not found" }, 404);
    const path = url.pathname.slice(BASE.length);

    if (req.method === "GET" && path === "/stats") {
      const cut = Date.now() - 30 * 60e3;
      const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM events").first()).n;
      const { results } = await env.DB.prepare("SELECT m, t FROM events WHERE t > ? ORDER BY t DESC LIMIT 10").bind(cut).all();
      return json({ total, recent: results });
    }

    if (req.method === "POST" && path === "/event") {
      if (!okOrigin || !origin) return json({ error: "origin" }, 403);   // только со своей страницы
      let m = 0;
      try { m = +(await req.json()).m; } catch (e) {}
      if (!(m >= 500 && m <= 500000)) return json({ error: "m" }, 400);
      const now = Date.now();
      const ip = req.headers.get("CF-Connecting-IP") || "";
      const day = new Date(now).toISOString().slice(0, 10);
      const hash = await sha256((env.SALT || "million") + day + ip);
      await env.DB.prepare("DELETE FROM seen WHERE t < ?").bind(now - 10 * 60e3).run();
      const dup = await env.DB.prepare("SELECT 1 FROM seen WHERE h = ?").bind(hash).first();
      if (!dup) {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO seen (h, t) VALUES (?, ?)").bind(hash, now),
          env.DB.prepare("INSERT INTO events (m, t) VALUES (?, ?)").bind(Math.round(m / 500) * 500, now),
        ]);
      }
      const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM events").first()).n;
      return json({ total });
    }
    return json({ error: "not found" }, 404);
  },
};

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
