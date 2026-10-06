// Счётчик реальных расчётов «Цель миллион» на Cloudflare Workers + D1 (бесплатный тариф).
// Страница на своём домене сама обращается к /api/million/… — достаточно повесить этот воркер на маршрут
//   ВАШ-ДОМЕН/api/million/*
// GET  /api/million/stats  → {"total": 128, "recent": [{"m": 7500, "t": 1791234567890}, …]}
// POST /api/million/event  {"m": 7500, "how": "calc" | "pdf"} — человек сам рассчитал план или скачал PDF
// Хранится только сумма взноса (округлённая до 500 ₽) и время. Адрес посетителя не хранится:
// для защиты от накрутки держим его солёный хеш 10 минут и удаляем.

const BASE = "/api/million";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(BASE)) return new Response("not found", { status: 404 });
    const path = url.pathname.slice(BASE.length);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

    if (req.method === "GET" && path === "/stats") {
      const cut = Date.now() - 30 * 60e3;
      const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM events").first()).n;
      const { results } = await env.DB.prepare("SELECT m, t FROM events WHERE t > ? ORDER BY t DESC LIMIT 10").bind(cut).all();
      return json({ total, recent: results });
    }

    if (req.method === "POST" && path === "/event") {
      // только со своей страницы
      const origin = req.headers.get("Origin") || "";
      if (origin && new URL(origin).host !== url.host) return json({ error: "origin" }, 403);
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
