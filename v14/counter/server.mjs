// Счётчик реальных расчётов для лендинга «Цель миллион».
// Без зависимостей: Node.js 18+. Запуск: PORT=8787 ALLOW_ORIGIN=https://million.gazfond-pn.com node server.mjs
//
// POST /million/event  {"m": 7500, "how": "calc"|"pdf"}  — человек рассчитал свой план (страница шлёт один раз за сессию)
// GET  /million/stats  → {"total": 12480, "recent": [{"m": 7500, "t": 1791234567890}, ...]}
//
// Хранит только сумму взноса (округлённую до 500 ₽) и время. Никаких персональных данных, IP не сохраняется.
import http from "node:http";
import fs from "node:fs";

const PORT = +process.env.PORT || 8787;
const ALLOW = (process.env.ALLOW_ORIGIN || "https://million.gazfond-pn.com").split(",").map((s) => s.trim());
const FILE = process.env.DATA_FILE || "./million-counter.json";
const BASE = process.env.BASE_PATH || "/million";

let db = { total: 0, recent: [] };
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
let dirty = false;
setInterval(() => { if (dirty) { fs.writeFile(FILE, JSON.stringify(db), () => {}); dirty = false; } }, 5000);

// защита от накрутки: не больше одного события с адреса за 10 минут (адреса держим только в памяти)
const seen = new Map();
setInterval(() => { const now = Date.now(); for (const [k, t] of seen) if (now - t > 10 * 60e3) seen.delete(k); }, 60e3);

function send(res, code, body, origin) {
  const h = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin && ALLOW.includes(origin)) { h["Access-Control-Allow-Origin"] = origin; h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"; h["Access-Control-Allow-Headers"] = "Content-Type"; }
  res.writeHead(code, h); res.end(body ? JSON.stringify(body) : "");
}

http.createServer((req, res) => {
  const origin = req.headers.origin || "";
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204, null, origin);
  if (req.method === "GET" && url.pathname === BASE + "/stats") {
    const cut = Date.now() - 30 * 60e3;
    return send(res, 200, { total: db.total, recent: db.recent.filter((e) => e.t > cut).slice(-10) }, origin);
  }
  if (req.method === "POST" && url.pathname === BASE + "/event") {
    if (!ALLOW.includes(origin)) return send(res, 403, { error: "origin" }, origin);
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 512) req.destroy(); });
    req.on("end", () => {
      let m = 0; try { m = +JSON.parse(body).m; } catch {}
      if (!(m >= 500 && m <= 500000)) return send(res, 400, { error: "m" }, origin);
      if (seen.has(ip)) return send(res, 200, { total: db.total }, origin);
      seen.set(ip, Date.now());
      db.total += 1; db.recent.push({ m: Math.round(m / 500) * 500, t: Date.now() }); db.recent = db.recent.slice(-50); dirty = true;
      send(res, 200, { total: db.total }, origin);
    });
    return;
  }
  send(res, 404, { error: "not found" }, origin);
}).listen(PORT, () => console.log("million counter on :" + PORT + BASE));
