/* =====================================================================
   «Цель миллион» · личный план ПДС в PDF (v2, по утверждённому макету).
   Два макета из одних данных (planData() в app.js):
   · a4    — 7 страниц для компьютера и печати;
   · phone — 8 экранов 360×780 pt, по одной мысли на экран.
   Градиентные цифры и фоны рисуются на canvas тем же шрифтом Inter
   и вставляются картинками; всё остальное — вектор.
   window.buildPlanPdf(D, mode) → Promise<Blob>
   ===================================================================== */
(function () {
  "use strict";
  var C = {
    ink: "#1D1D1F", ink2: "#424245", muted: "#6E6E73", faint: "#86868B", line: "#E5E5EA", check: "#C7C7CC",
    white: "#FFFFFF", card: "#F5F5F7", blue: "#0064FF", sky: "#1E8FFA", vio: "#6B5BFF", warm: "#FF7D4A", warm2: "#FF9F78", green: "#14A570",
    blueSoft: "#EEF4FF", warmSoft: "#FFF0E8", greenSoft: "#E9F7F0", hatch: "#D8D8DD"
  };
  var GRAD = [[0, "#1E8FFA"], [0.45, "#0064FF"], [0.7, "#6B5BFF"], [1, "#FF7D4A"]];
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return "#" + [0, 1, 2].map(function (i) { return ("0" + Math.round(x[i] + (y[i] - x[i]) * t).toString(16)).slice(-2); }).join(""); }

  /* ---------- canvas: шрифт, градиентный текст, фоны ---------- */
  var fontReady = null;
  function loadFont() {
    if (fontReady) return fontReady;
    fontReady = new Promise(function (res) {
      try {
        var b = atob(window.__PDF_FONT_700), u = new Uint8Array(b.length);
        for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        var f = new FontFace("PdfInter700", u.buffer, { weight: "700" });
        f.load().then(function (ff) { document.fonts.add(ff); res(true); }, function () { res(false); });
      } catch (e) { res(false); }
    });
    return fontReady;
  }
  var PX = 4; /* пикселей canvas на один pt */
  function gradText(txt, size) {
    var c = document.createElement("canvas"), x = c.getContext("2d"), f = "700 " + (size * PX) + "px PdfInter700, Inter, -apple-system, sans-serif";
    x.font = f; try { x.letterSpacing = (-size * PX * 0.03) + "px"; } catch (e) {}
    var w = Math.ceil(x.measureText(txt).width + size * PX * 0.1), h = Math.ceil(size * PX * 1.22);
    c.width = w; c.height = h; x = c.getContext("2d"); x.font = f; try { x.letterSpacing = (-size * PX * 0.03) + "px"; } catch (e) {}
    var g = x.createLinearGradient(0, 0, w, h * 0.15); GRAD.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.textBaseline = "alphabetic"; x.fillText(txt, 0, size * PX * 0.95);
    return { url: c.toDataURL("image/png"), w: w / PX, h: h / PX };
  }
  function rrPath(x, w, h, r) { x.beginPath(); x.moveTo(r, 0); x.arcTo(w, 0, w, h, r); x.arcTo(w, h, 0, h, r); x.arcTo(0, h, 0, 0, r); x.arcTo(0, 0, w, 0, r); x.closePath(); }
  /* скруглённая плашка с линейным градиентом */
  function gradCard(w, h, r, stops, angle) {
    var k = 2, c = document.createElement("canvas"); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    var x = c.getContext("2d"), a = (angle || 120) * Math.PI / 180, cx = c.width / 2, cy = c.height / 2, L = Math.abs(c.width * Math.cos(a)) / 2 + Math.abs(c.height * Math.sin(a)) / 2;
    var g = x.createLinearGradient(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    rrPath(x, c.width, c.height, r * k); x.fillStyle = g; x.fill();
    return c.toDataURL("image/png");
  }
  /* фон обложки: мягкие цветные пятна на светлом */
  function coverBg(w, h, phone) {
    var k = 1.6, c = document.createElement("canvas"); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    var x = c.getContext("2d"); x.fillStyle = "#FBFBFD"; x.fillRect(0, 0, c.width, c.height);
    var spots = phone
      ? [[0.9, 0.45, 0.75, "30,143,250", 0.22], [0.1, 1.0, 0.66, "255,125,74", 0.18], [1.0, 0.9, 0.62, "107,91,255", 0.14]]
      : [[0.85, 0.18, 0.45, "30,143,250", 0.22], [1.0, 0.7, 0.4, "107,91,255", 0.16], [0.7, 1.0, 0.45, "255,125,74", 0.2]];
    spots.forEach(function (s) {
      var R = s[2] * c.width, g = x.createRadialGradient(s[0] * c.width, s[1] * c.height, 0, s[0] * c.width, s[1] * c.height, R);
      g.addColorStop(0, "rgba(" + s[3] + "," + s[4] + ")"); g.addColorStop(0.7, "rgba(" + s[3] + ",0)");
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    });
    return c.toDataURL("image/jpeg", 0.9);
  }

  window.buildPlanPdf = function (D, mode) {
    return loadFont().then(function () { return build(D, mode); });
  };

  function build(D, mode) {
    var jsPDF = window.jspdf.jsPDF, phone = mode === "phone";
    var G = phone ? { w: 360, h: 780, m: 24 } : { w: 595.28, h: 841.89, m: 51 };
    var W = G.w - G.m * 2, MM = 2.8346, pages = phone ? 8 : 7, pageNo = 0;
    var doc = new jsPDF({ unit: "pt", format: [G.w, G.h], orientation: "portrait", compress: true });
    doc.addFileToVFS("Inter-500.ttf", window.__PDF_FONT_500); doc.addFont("Inter-500.ttf", "Inter", "normal");
    doc.addFileToVFS("Inter-700.ttf", window.__PDF_FONT_700); doc.addFont("Inter-700.ttf", "Inter", "bold");
    doc.setProperties({ title: "Личный план · Цель миллион", subject: "Предварительный расчёт программы долгосрочных сбережений", author: "АО «НПФ ГАЗФОНД пенсионные накопления»", creator: "ГАЗФОНД ПН" });
    var rub = D.rub, NB = " ";

    /* ---------- примитивы ---------- */
    function fill(c) { var a = hex(c); doc.setFillColor(a[0], a[1], a[2]); }
    function stroke(c) { var a = hex(c); doc.setDrawColor(a[0], a[1], a[2]); }
    function color(c) { var a = hex(c); doc.setTextColor(a[0], a[1], a[2]); }
    function font(size, bold) { doc.setFont("Inter", bold ? "bold" : "normal"); doc.setFontSize(size); }
    function tw(s, size, bold) { font(size, bold); return doc.getTextWidth(String(s)); }
    /* текст: y — верх строки; возвращает y под блоком */
    function T(str, x, y, o) {
      o = o || {}; var size = o.size || 10; font(size, o.bold); color(o.color || C.ink);
      var lh = size * (o.lh || 1.32), lines = o.maxW ? doc.splitTextToSize(String(str), o.maxW) : [String(str)];
      lines.forEach(function (ln, i) { doc.text(ln, x, y + size * 0.8 + i * lh, { align: o.align || "left", charSpace: o.cs || 0 }); });
      return y + lines.length * lh;
    }
    function TH(str, size, maxW, lh, bold) { font(size, bold); return doc.splitTextToSize(String(str), maxW).length * size * (lh || 1.32); }
    /* текст с жирными фрагментами: runs = [[текст, жирный?], …] */
    function RT(runs, x, y, o) {
      var size = o.size, lh = size * (o.lh || 1.4), maxW = o.maxW, toks = [];
      runs.forEach(function (r) { String(r[0]).split(/( +)/).forEach(function (t) { if (t) toks.push([t, !!r[1]]); }); });
      var lines = [[]], cw = 0;
      toks.forEach(function (t) {
        var w = tw(t[0], size, t[1]), sp = /^ +$/.test(t[0]);
        if (!sp && cw + w > maxW && lines[lines.length - 1].length) { lines.push([]); cw = 0; }
        if (sp && !lines[lines.length - 1].length) return;
        lines[lines.length - 1].push([t[0], t[1], w]); cw += w;
      });
      if (o.measure) return lines.length * lh;
      lines.forEach(function (ln, i) {
        var cx = x;
        ln.forEach(function (t) { font(size, t[1]); color(t[1] ? (o.bcolor || C.ink) : (o.color || C.ink2)); doc.text(t[0], cx, y + size * 0.8 + i * lh); cx += t[2]; });
      });
      return y + lines.length * lh;
    }
    function rr(x, y, w, h, r, c) { fill(c); doc.roundedRect(x, y, w, h, Math.min(r, h / 2, w / 2), Math.min(r, h / 2, w / 2), "F"); }
    function rrS(x, y, w, h, r, c, lw) { stroke(c); doc.setLineWidth(lw || 0.8); doc.roundedRect(x, y, w, h, Math.min(r, h / 2), Math.min(r, h / 2), "S"); }
    function img(url, x, y, w, h, fmt) { if (url) try { doc.addImage(url, fmt || "PNG", x, y, w, h, undefined, "FAST"); } catch (e) {} }
    function fitImg(url, ratio, x, y, box) { if (!url) return; var w = box, h = box; if (ratio > 1) h = box / ratio; else w = box * ratio; img(url, x + (box - w) / 2, y + (box - h) / 2, w, h); }
    function dot(x, y, r, c) { fill(c); doc.circle(x, y, r, "F"); }
    function gtext(txt, size, x, y, align) { var g = gradText(txt, size); var gx = align === "right" ? x - g.w : x; img(g.url, gx, y, g.w, g.h); return g; }
    function hr(x1, x2, y) { stroke(C.line); doc.setLineWidth(0.6); doc.line(x1, y, x2, y); }
    function eyebrow(txt, y, c) { return T(txt.toUpperCase(), G.m, y, { size: phone ? 9.75 : 8.5, bold: true, color: c || C.warm, cs: phone ? 0.6 : 0.5 }); }
    function h2(txt, y) { return T(txt, G.m, y, { size: phone ? 24 : 22, bold: true, maxW: W, lh: 1.12 }); }
    function lead(txt, y) { return T(txt, G.m, y, { size: phone ? 12.75 : 12, color: C.muted, maxW: W, lh: 1.38 }); }
    function checkbox(x, y, s) { rrS(x, y, s, s, s * 0.25, C.check, 0.85); }

    function top() {
      pageNo++;
      var lh = phone ? 22.5 : 25.5;
      if (D.img.logo) img(D.img.logo, G.m, G.m - (phone ? 0 : 2), lh * (D.img.logoRatio || 1.7), lh);
      T(phone ? pageNo + " / " + pages : "Личный план · " + D.dateTxt, G.w - G.m, G.m + lh / 2 - (phone ? 6 : 5), { size: phone ? 9.75 : 8.5, color: C.faint, align: "right" });
      return G.m + lh;
    }
    function foot() {
      if (phone) return;
      var y = G.h - 28 - 12;
      hr(G.m, G.w - G.m, y);
      T(pageNo === pages ? "АО «НПФ ГАЗФОНД пенсионные накопления» · лицензия Банка России № 430" : "Цель миллион · личный план", G.m, y + 6, { size: 7.5, color: C.faint });
      T(pageNo + " / " + pages, G.w - G.m, y + 6, { size: 7.5, color: C.faint, align: "right" });
    }
    function newPage() { doc.addPage([G.w, G.h]); fill(C.white); doc.rect(0, 0, G.w, G.h, "F"); }
    function head(eb, title, sub) {
      var y = top() + (phone ? 33 : 28);
      y = eyebrow(eb, y) + (phone ? 6 : 5);
      y = h2(title, y) + (sub ? (phone ? 6 : 8) : 0);
      if (sub) y = lead(sub, y);
      return y;
    }

    /* ---------- общие тексты ---------- */
    var hp = D.hp, V = D.V, full = D.now15 ? "через 15 лет" : D.yrs;
    var milWord = D.mil ? "Первый миллион" : "Цель " + rub(D.target);
    var ratioTxt = "×" + (Math.round(D.ratio * 10) / 10).toFixed(1).replace(".", ",");
    var disclaimer = "Расчёт предварительный и не является гарантией дохода. Доходность 10 % годовых взята для примера, доход фонда не гарантирован. Господдержка до 36 000 ₽ в год в первые 10 лет при взносах от 2 000 ₽ в год, размер зависит от официального дохода. Налоговый вычет от 13 до 22 % от взносов (не более чем с 400 000 ₽ в год) возвращает ФНС по вашему заявлению, в расчёте взято 13 %. Выплаты по общему правилу доступны через 15 лет действия договора либо с 55 лет женщинам и 60 лет мужчинам. При досрочном расторжении выплачивается выкупная сумма, она может быть меньше внесённого. Средства застрахованы АСВ на сумму до 2,8 млн ₽. " + D.paramsTxt;
    var src = [
      { k: "Ваши взносы", d: rub(D.monthly) + " в месяц" + (D.months ? ", " + D.months + " " + D.plural(D.months, ["месяц", "месяца", "месяцев"]) : "") + (D.first ? ", старт " + rub(D.first) : "") + ". Можно менять и пропускать", dS: rub(D.monthly) + " × " + D.months + " " + D.plural(D.months, ["месяц", "месяца", "месяцев"]), v: rub(hp.contrib), c: C.blue },
      { k: "Господдержка", d: D.cofinRatio + ", до 36 000 ₽ в год, первые 10 лет", dS: "первые 10 лет", v: "+ " + rub(hp.cofin), c: C.warm },
      { k: "Налоговый вычет", d: D.reinvest ? "13 % от взносов, возвращаете его на счёт" : "вернётся вам, в сумму на счёте не входит", dS: D.reinvest ? "13 %, на счёт" : "не на счёт", v: D.reinvest ? "+ " + rub(hp.ded) : "0 ₽", c: C.warm2 },
      { k: "Доход фонда, прогноз", d: "при доходности 10 % годовых, взята для примера", dS: "прогноз, 10 % годовых", v: "+ " + rub(hp.inc), c: C.sky }
    ];
    function bar4(x, y, w, h) {
      var t = V || 1, parts = [[hp.contrib, C.blue], [hp.cofin, C.warm], [hp.ded, C.warm2], [hp.inc, C.sky]].filter(function (p) { return p[0] > 0; }), gap = 1.8, cx = x;
      var usable = w - gap * (parts.length - 1);
      parts.forEach(function (p, i) {
        var pw = p[0] / t * usable; fill(p[1]);
        var r = h / 2;
        if (parts.length === 1) doc.roundedRect(cx, y, pw, h, r, r, "F");
        else if (i === 0) { doc.roundedRect(cx, y, Math.min(pw, r * 2 + 1), h, r, r, "F"); doc.rect(cx + r, y, pw - r, h, "F"); }
        else if (i === parts.length - 1) { doc.roundedRect(cx + pw - Math.min(pw, r * 2 + 1), y, Math.min(pw, r * 2 + 1), h, r, r, "F"); doc.rect(cx, y, pw - r, h, "F"); }
        else doc.rect(cx, y, pw, h, "F");
        cx += pw + gap;
      });
    }
    function button(x, y, w, h, label, url, sub) {
      rr(x, y, w, h, h / 2, C.blue);
      T(label, x + w / 2, y + (sub ? h * 0.2 : h / 2 - (phone ? 7.5 : 7.5)), { size: phone ? 14.25 : 14, bold: true, color: C.white, align: "center" });
      if (sub) T(sub, x + w / 2, y + h * 0.58, { size: 8.5, color: "#D6E4FF", align: "center" });
      doc.link(x, y, w, h, { url: url });
    }
    function qr(x, y, size) {
      if (!window.__PDF_QR) return;
      var rows = window.__PDF_QR.rows, n = rows.length, cell = size / n;
      fill(C.white); doc.rect(x - cell * 2, y - cell * 2, size + cell * 4, size + cell * 4, "F");
      fill(C.ink);
      rows.forEach(function (r, ry) { for (var rx = 0; rx < n; rx++) if (r.charAt(rx) === "1") doc.rect(x + rx * cell, y + ry * cell, cell + 0.15, cell + 0.15, "F"); });
      doc.link(x, y, size, size, { url: window.__PDF_QR.url });
    }
    function icoPlus(cx, cy, s, c) { stroke(c); doc.setLineWidth(s * 0.13); doc.setLineCap && doc.setLineCap("round"); doc.line(cx - s / 2, cy, cx + s / 2, cy); doc.line(cx, cy - s / 2, cx, cy + s / 2); }
    function icoBack(cx, cy, s, c) {
      stroke(c); doc.setLineWidth(s * 0.1); var r = s / 2, segs = [], a0 = -2.4, a1 = 2.9, N = 18, px = cx + r * Math.cos(a0), py = cy + r * Math.sin(a0);
      for (var i = 1; i <= N; i++) { var a = a0 + (a1 - a0) * i / N, nx = cx + r * Math.cos(a), ny = cy + r * Math.sin(a); segs.push([nx - px, ny - py]); px = nx; py = ny; }
      doc.lines(segs, cx + r * Math.cos(a0), cy + r * Math.sin(a0), [1, 1], "S", false);
      var ex = cx + r * Math.cos(a0), ey = cy + r * Math.sin(a0);
      doc.line(ex, ey, ex - s * 0.02, ey - s * 0.32); doc.line(ex, ey, ex + s * 0.3, ey + s * 0.06);
    }
    /* вертикальная линия времени с плавным переходом цвета */
    function tline(x, y1, y2, w) {
      var N = 40, stops = [[0, C.sky], [0.6, C.blue], [1, C.green]];
      doc.setLineWidth(w);
      for (var i = 0; i < N; i++) {
        var t = i / N, c; if (t < 0.6) c = mix(stops[0][1], stops[1][1], t / 0.6); else c = mix(stops[1][1], stops[2][1], (t - 0.6) / 0.4);
        stroke(c); doc.line(x, y1 + (y2 - y1) * i / N, x, y1 + (y2 - y1) * (i + 1) / N + 0.3);
      }
    }
    function payWord() { return D.now15 ? "Через 15 лет" : "Выплаты станут доступны"; }

    /* =========================================================== A4 */
    function a4() {
      var m = G.m, y, x;
      /* ---------- 1. обложка ---------- */
      img(coverBg(G.w, G.h, false), 0, 0, G.w, G.h, "JPEG");
      top();
      if (D.img.column) { var cw = 78 * MM, ch = cw / (D.img.columnRatio || 0.5625); if (ch > 400) { ch = 400; cw = ch * (D.img.columnRatio || 0.5625); } img(D.img.column, G.w - 4 - cw, 262, cw, ch); }
      y = T("Ваш план «Цель миллион»", m, 176, { size: 15, bold: true, color: C.ink2 }) + 12;
      var gs = 46, gw = tw(rub(V), gs, true) * 0.97; if (gw > 320) gs = gs * 320 / gw;
      var gt = gtext(rub(V), gs, m, y); y += gt.h + 10;
      y = T(D.whenTxt, m, y, { size: 13, color: C.ink2, maxW: 95 * MM, lh: 1.35 }) + 26;
      var cx = m, cy = y, chipH = 22;
      D.chips.forEach(function (c) { var w = tw(c, 9.5, true) + 22; if (cx + w > m + 100 * MM) { cx = m; cy += chipH + 7; } rr(cx, cy, w, chipH, 11, C.white); rrS(cx, cy, w, chipH, 11, C.line, 0.7); T(c, cx + 11, cy + 6.2, { size: 9.5, bold: true }); cx += w + 7; });
      var facts = [
        ["Ваши взносы за " + D.pmYears + " " + D.plural(D.pmYears, ["год", "года", "лет"]), rub(hp.contrib), "остальное добавят государство, вычет и доход фонда"],
        [milWord, D.gIn, D.gYear ? "в " + D.gYear + " году" : "при таком взносе"],
        ["Если получать 10 лет", "около " + rub(D.pay10), "в месяц, без учёта дохода в период выплат"]
      ];
      var fw = (W - 8 * MM) / 3, fh = 30 * MM, fy = G.h - 34 * MM - fh;
      facts.forEach(function (f, i) {
        var fx = m + i * (fw + 4 * MM);
        rr(fx, fy, fw, fh, 5 * MM, C.white); rrS(fx, fy, fw, fh, 5 * MM, "#ECECF0", 0.6);
        var yy = T(f[0], fx + 14, fy + 14, { size: 8.5, color: C.muted, maxW: fw - 28 });
        var vs = 17; while (tw(f[1], vs, true) > fw - 28 && vs > 11) vs -= 0.5;
        yy = T(f[1], fx + 14, yy + 4, { size: vs, bold: true }) ;
        T(f[2], fx + 14, yy + 3, { size: 8.5, color: C.muted, maxW: fw - 28, lh: 1.35 });
      });
      var fy2 = G.h - 12 * MM - 8;
      T("АО «НПФ ГАЗФОНД пенсионные накопления» · лицензия Банка России № 430", m, fy2, { size: 7.5, color: C.faint });
      T("Расчёт предварительный, доход не гарантирован", G.w - m, fy2, { size: 7.5, color: C.faint, align: "right" });

      /* ---------- 2. откуда деньги ---------- */
      newPage();
      y = head("План на одной странице", "Откуда возьмутся " + D.shortRub(V) + NB + "₽", "Вы вносите " + rub(hp.contrib) + ". Ещё " + rub(hp.add) + " добавят другие источники");
      bar4(m, y + 6 * MM, W, 4 * MM); y += 10 * MM + 4;
      src.forEach(function (s, i) {
        var rh = 58;
        fitImg(D.img.src[i], D.img.srcRatio[i], m, y + (rh - 34) / 2, 34);
        dot(m + 48 + 3.2, y + 19.5, 3.1, s.c);
        T(s.k, m + 48 + 10, y + 13.5, { size: 11.5, bold: true });
        T(s.d, m + 48, y + 30, { size: 8.5, color: C.muted, maxW: W - 48 - 130 });
        T(s.v, m + W, y + rh / 2 - 9, { size: 17, bold: true, align: "right" });
        y += rh; hr(m, m + W, y);
      });
      y += 14;
      T("На счёте " + full, m, y + 12, { size: 12, bold: true, color: C.ink2 });
      var tg = gradText(rub(V), 30); img(tg.url, m + W - tg.w, y, tg.w, tg.h); y += tg.h + 7 * MM;
      var rh2 = 36 * MM;
      img(gradCard(W, rh2, 6 * MM, [[0, "#EEF4FF"], [1, "#FFF1EA"]], 20), m, y, W, rh2);
      var rg = gradText(ratioTxt, 44); img(rg.url, m + 7 * MM, y + (rh2 - rg.h) / 2 + 2, rg.w, rg.h);
      var rx = m + 7 * MM + Math.max(rg.w, 34 * MM) + 7 * MM, rwid = m + W - 7 * MM - rx;
      var runs = [["По этому расчёту ", 0], ["каждый ваш рубль превращается примерно в " + ratioTxt.slice(1) + NB + "₽", 1], [". Без учёта дохода фонда это ", 0], [rub(D.noInc), 1], [": ваши взносы, господдержка" + (D.reinvest ? " и вычет" : ""), 0]];
      var rth = RT(runs, 0, 0, { size: 11, maxW: rwid, measure: true });
      RT(runs, rx, y + (rh2 - rth) / 2, { size: 11, maxW: rwid, lh: 1.45 });
      y += rh2 + 6 * MM;
      var tri = [[milWord, D.gYear ? "в " + D.gYear + " году" : "позже 40 лет", D.gIn], [D.now15 ? "Выплаты по возрасту" : payWord(), D.now15 ? "уже доступны" : "в " + D.payYear + " году", D.now15 ? "в плане сумма через 15 лет" : full], ["Господдержка идёт", Math.max(0, D.govTo - D.govFrom + 1) + " " + D.plural(Math.max(0, D.govTo - D.govFrom + 1), ["год", "года", "лет"]), "с " + D.govFrom + " по " + D.govTo + " год"]];
      var tw3 = (W - 8 * MM) / 3, th3 = 25 * MM;
      tri.forEach(function (f, i) {
        var fx = m + i * (tw3 + 4 * MM); rr(fx, y, tw3, th3, 5 * MM, C.card);
        T(f[0], fx + 6 * MM, y + 5 * MM, { size: 8.5, color: C.muted, maxW: tw3 - 12 * MM });
        var vs = 16; while (tw(f[1], vs, true) > tw3 - 12 * MM && vs > 10) vs -= 0.5;
        T(f[1], fx + 6 * MM, y + 5 * MM + 15, { size: vs, bold: true });
        T(f[2], fx + 6 * MM, y + 5 * MM + 38, { size: 8.5, color: C.muted, maxW: tw3 - 12 * MM });
      });
      foot();

      /* ---------- 3. дорожная карта ---------- */
      newPage();
      y = head("Дорожная карта", D.now15 ? "Год за годом" : "Год за годом до выплат", "Сумма на счёте в конце каждого года. Отмечайте пройденные годы") + 5 * MM;
      var Y = D.years, nH = Y.filter(function (r) { return r.cls; }).length, avail = G.h - 70 - y - 30;
      var rowN = 25, rowH = 36; var need = (Y.length - nH) * rowN + nH * (rowH + 6);
      if (need > avail) { var k = avail / need; rowN *= k; rowH *= k; }
      var lx = m + 21.2 * MM, ex = m + 28 * MM, ax = m + W - 11 * MM, ckx = m + W - 4 * MM, t0 = y + 6, rowsY = [];
      var yy2 = y; Y.forEach(function (r) { var h = r.cls ? rowH + 6 : rowN; rowsY.push([yy2, h]); yy2 += h; });
      tline(lx, t0, yy2 - 8, 1.4);
      Y.forEach(function (r, i) {
        var ry = rowsY[i][0], h = rowsY[i][1], mid = ry + h / 2, hl = !!r.cls && r.cls !== "gov";
        if (hl) rr(m - 3 * MM, ry + 3, W + 6 * MM, h - 6, 3 * MM, r.cls.indexOf("fin") >= 0 ? C.greenSoft : C.card);
        T(String(r.y), m, mid - 5.5, { size: 10, bold: true, color: C.ink2 });
        if (hl) { var pc = r.cls.indexOf("fin") >= 0 ? C.green : C.blue; dot(lx, mid, 7, mix(pc, "#FFFFFF", 0.82)); dot(lx, mid, 4.3, pc); }
        else { dot(lx, mid, 4.6, r.cls === "gov" ? C.warm : C.blue); dot(lx, mid, 2.9, C.white); }
        var es = hl ? 10.5 : 9.5;
        if (r.evB || r.ev) RT([[r.evB, 1], [r.ev, 0]], ex, mid - es * 0.62, { size: es, maxW: ax - ex - 95, color: C.muted, bcolor: C.ink, lh: 1.2 });
        var ac = r.cls.indexOf("fin") >= 0 ? C.green : r.cls.indexOf("mil") >= 0 ? C.blue : C.ink;
        T(rub(r.v), ax, mid - (hl ? 7.5 : 6), { size: hl ? 13 : 10, bold: true, color: ac, align: "right" });
        checkbox(ckx, mid - 5.5, 11);
      });
      T((D.now15 ? "" : "Последняя сумма указана на момент, когда станут доступны выплаты. ") + "Господдержка за год поступает на счёт в следующем году", m, yy2 + 8, { size: 8, color: C.faint, maxW: W });
      foot();

      /* ---------- 4. первый год ---------- */
      newPage();
      y = head("Первый год", "Что сделать и что получить", "Пять шагов, после которых план работает сам") + 8 * MM;
      var F1 = D.fy, Y0 = D.startYear, Y1 = Y0 + 1;
      var steps = [
        [F1.monthName, "Сегодня", String(Y0), C.blue, "Оформить договор и сделать первый взнос", "Через Госуслуги, около 10 минут. Часть данных подставится автоматически", rub(D.first ? D.first + D.monthly : D.monthly), ""],
        ["Сразу", "Авто", "платёж", C.blue, "Подключить автоплатёж", rub(D.monthly) + " в месяц, например на следующий день после зарплаты. Взнос можно изменить или поставить на паузу в любой момент", rub(D.monthly), "каждый месяц"],
        ["Декабрь", "31", String(Y0), C.warm, "Внести от 2 000 ₽ до конца года", "Взносы " + Y0 + " года дают право на господдержку и налоговый вычет за этот год. По плану за " + Y0 + " год вы внесёте " + rub(F1.own0) + (F1.own0 < 2000 ? ". Добавьте до 2 000 ₽, чтобы получить господдержку" : ""), rub(F1.own0), "за " + Y0 + " год"],
        ["С января", "Вычет", String(Y1), C.warm2, "Получить налоговый вычет за " + Y0 + " год", "Заявление в личном кабинете налогоплательщика." + (D.reinvest ? " Верните деньги на счёт, так посчитан ваш план" : ""), "+ " + rub(F1.ded0), ""],
        ["В течение", String(Y1), "года", C.green, "Господдержка за " + Y0 + " год придёт на счёт", "Делать ничего не нужно, фонд сам передаст сведения. К концу " + Y1 + " года на счёте будет около " + rub(Math.round(F1.endY1 / 100) * 100), "+ " + rub(F1.gov0), ""]
      ];
      steps.forEach(function (s) {
        var calW = 24 * MM, pad = 5 * MM, amtW = tw(s[6], 15, true) + 4, txX = m + pad + calW + 5 * MM, txW = m + W - pad - amtW - 5 * MM - txX;
        var hh = TH(s[4], 12, txW, 1.25, true) + 3.4 + TH(s[5], 9.5, txW, 1.45);
        var calH = 20 * MM, h = Math.max(calH, hh) + pad * 2;
        rr(m, y, W, h, 5 * MM, s[3] === C.warm ? C.warmSoft : C.card);
        var cy2 = y + pad;
        rr(m + pad, cy2, calW, calH, 3 * MM, C.white);
        fill(s[3]); doc.roundedRect(m + pad, cy2, calW, 5.2 * MM, 3 * MM, 3 * MM, "F"); doc.rect(m + pad, cy2 + 2.6 * MM, calW, 2.6 * MM, "F");
        T(s[0].toUpperCase(), m + pad + calW / 2, cy2 + 3.8, { size: 6.8, bold: true, color: C.white, align: "center", cs: 0.3 });
        var ds = 14; while (tw(s[1], ds, true) > calW - 8 && ds > 9) ds -= 0.5;
        T(s[1], m + pad + calW / 2, cy2 + 5.2 * MM + 6, { size: ds, bold: true, align: "center" });
        T(s[2], m + pad + calW / 2, cy2 + calH - 11, { size: 7.5, color: C.faint, align: "center" });
        var ty = T(s[4], txX, y + pad, { size: 12, bold: true, maxW: txW, lh: 1.25 });
        T(s[5], txX, ty + 3.4, { size: 9.5, color: C.muted, maxW: txW, lh: 1.45 });
        T(s[6], m + W - pad, y + h / 2 - (s[7] ? 13 : 8.5), { size: 15, bold: true, align: "right" });
        if (s[7]) T(s[7], m + W - pad, y + h / 2 + 5, { size: 8, color: C.muted, align: "right" });
        y += h + 3.5 * MM;
      });
      if (D.govTo > Y1) {
        y += 1.5 * MM; var ch4 = 22 * MM; rr(m, y, W, ch4, 5 * MM, C.card);
        T("Каждый следующий год, пока идёт господдержка", m + 6 * MM, y + 5 * MM, { size: 8.5, color: C.muted });
        T("+ " + rub(F1.gov1) + " господдержки" + (F1.ded1 ? " и + " + rub(F1.ded1) + " вычета" : ""), m + 6 * MM, y + 5 * MM + 14, { size: 14, bold: true });
      }
      foot();

      /* ---------- 5. что если ---------- */
      newPage();
      y = head("Что если", "Другие суммы и честный диапазон", "На счёте " + full + " при разном взносе") + 7 * MM;
      var S = D.scen, n = S.length, sw = (W - 3 * MM * (n - 1)) / n, sh = 66 * MM, maxV = Math.max.apply(null, S.map(function (s) { return s.v; }));
      S.forEach(function (s, i) {
        var sx = m + i * (sw + 3 * MM);
        if (s.me) { rr(sx, y, sw, sh, 5 * MM, C.white); rrS(sx + 0.8, y + 0.8, sw - 1.6, sh - 1.6, 5 * MM, C.blue, 1.7); } else rr(sx, y, sw, sh, 5 * MM, C.card);
        var bh = Math.max(4 * MM, s.v / maxV * 38 * MM), by = y + 5 * MM + 38 * MM - bh;
        img(gradCard(12 * MM, bh, 2 * MM, [[0, C.sky], [1, C.blue]], 90), sx + sw / 2 - 6 * MM, by, 12 * MM, bh);
        var ly = y + 46 * MM;
        if (s.me) { var l1 = "Ваш план", l2 = " · " + rub(s.m); var w1 = tw(l1, 9, true), w2 = tw(l2, 9); T(l1, sx + sw / 2 - (w1 + w2) / 2, ly, { size: 9, bold: true, color: C.blue }); T(l2, sx + sw / 2 - (w1 + w2) / 2 + w1, ly, { size: 9, color: C.muted }); }
        else T(rub(s.m) + " в месяц", sx + sw / 2, ly, { size: 9, color: C.muted, align: "center" });
        T(D.shortRub(s.v) + NB + "₽", sx + sw / 2, ly + 14, { size: 15, bold: true, align: "center" });
        T(s.gTxt, sx + sw / 2, ly + 34, { size: 8.5, color: C.muted, align: "center", maxW: sw - 16 });
      });
      y += sh + 5 * MM;
      var pH = 24 * MM; rr(m, y, W, pH, 5 * MM, C.blueSoft);
      var pk = "+1 000 ₽", pkw = tw(pk, 22, true); T(pk, m + 6 * MM, y + pH / 2 - 13, { size: 22, bold: true, color: C.blue });
      var pr = [["Если добавить к взносу 1 000 ₽ в месяц, " + full + " на счёте будет на ", 0], [rub(D.plus.add), 1], [" больше", 0]].concat(D.plus.sooner ? [[", а " + (D.mil ? "миллион" : "цель") + " наберётся ", 0], [D.plus.sooner, 1]] : []);
      var prx = m + 12 * MM + pkw, prw = m + W - 6 * MM - prx, prh = RT(pr, 0, 0, { size: 10.5, maxW: prw, measure: true, lh: 1.42 });
      RT(pr, prx, y + (pH - prh) / 2, { size: 10.5, maxW: prw, lh: 1.42 });
      y += pH + 9 * MM;
      y = T("Если доходность будет ниже", m, y, { size: 14, bold: true }) + 4;
      y = T("Доход фонда не гарантирован. Так меняется результат при взносе " + rub(D.monthly), m, y, { size: 9.5, color: C.faint }) + 6 * MM;
      var rows5 = D.yields.map(function (q, i) { return [(q.r * 100) + " % годовых", i === 0 ? "как в вашем плане" : "", q.v, i === 0 ? 1 : i === 1 ? 0.8 : 0.6]; }).concat([["Без дохода фонда", "взносы, господдержка" + (D.reinvest ? ", вычет" : ""), D.noInc, -1]]);
      var yMax = D.yields[0].v, lw5 = 34 * MM, vw5 = 30 * MM, tkx = m + lw5 + 4 * MM, tkw = W - lw5 - vw5 - 8 * MM;
      rows5.forEach(function (r) {
        var rh5 = 10 * MM; T(r[0], m, y + (r[1] ? 3 : 7), { size: 9.5, bold: true, color: C.ink2 }); if (r[1]) T(r[1], m, y + 16, { size: 8, color: C.muted, maxW: lw5, lh: 1.2 });
        rr(tkx, y + 1.5 * MM, tkw, 7 * MM, 2 * MM, C.card);
        var bw = Math.max(6, r[2] / yMax * tkw);
        if (r[3] > 0) img(gradCard(bw, 7 * MM, 2 * MM, [[0, mix(C.blue, "#FFFFFF", 1 - r[3])], [1, mix(C.sky, "#FFFFFF", 1 - r[3])]], 0), tkx, y + 1.5 * MM, bw, 7 * MM);
        else { rr(tkx, y + 1.5 * MM, bw, 7 * MM, 2 * MM, C.hatch); stroke("#C7C7CC"); doc.setLineWidth(1.2); for (var hx = tkx + 3; hx < tkx + bw - 2; hx += 6) doc.line(hx, y + 1.5 * MM + 7 * MM - 1.5, Math.min(hx + 6, tkx + bw - 2), y + 1.5 * MM + 1.5); }
        T(rub(r[2]), m + W, y + 1.5 * MM + 4.5, { size: 12, bold: true, align: "right" });
        y += rh5 + 3 * MM;
      });
      y += 3 * MM;
      var kTxt = D.kAlt ? [["Господдержка зависит от дохода. При доходе до 80 тыс. ₽ в месяц государство добавляет 1 ₽ на каждый ваш рубль, и " + full + " на счёте было бы около ", 0], [D.shortRub(D.kAlt) + NB + "₽", 1]] : [["Взнос можно увеличить в любой момент, например после повышения зарплаты. Господдержка считается от ваших взносов за год", 0]];
      var kh = RT(kTxt, 0, 0, { size: 9.5, maxW: W - 12 * MM, measure: true, lh: 1.45 }) + 10 * MM;
      rr(m, y, W, kh, 5 * MM, C.card); RT(kTxt, m + 6 * MM, y + 5 * MM, { size: 9.5, maxW: W - 12 * MM, lh: 1.45 });
      foot();

      /* ---------- 6. выплаты и защита ---------- */
      newPage();
      y = head(D.now15 ? "Выплаты" : "Когда станут доступны выплаты", "Как можно получать деньги", "Форму выплаты выбираете вы. Цифры для суммы " + rub(V)) + 7 * MM;
      var pw1 = (W - 8 * MM) * 1.25 / 3.25, pw2 = (W - 8 * MM) / 3.25, ph = 44 * MM;
      img(gradCard(pw1, ph, 5 * MM, [[0, "#0B5CFF"], [1, "#6B5BFF"]], 60), m, y, pw1, ph);
      T("Ежемесячно 10 лет", m + 5 * MM, y + 6 * MM, { size: 9, color: "#DCE6FF" });
      var pv = "около " + rub(D.pay10), pvs = 20; while (tw(pv, pvs, true) > pw1 - 10 * MM && pvs > 12) pvs -= 0.5;
      T(pv, m + 5 * MM, y + 6 * MM + 16, { size: pvs, bold: true, color: C.white });
      T("в месяц", m + 5 * MM, y + 6 * MM + 16 + pvs * 1.15, { size: 11, bold: true, color: C.white });
      T("Срок выбираете сами, от 5 лет. Остаток наследуется", m + 5 * MM, y + ph - 6 * MM - 22, { size: 8.5, color: "#DCE6FF", maxW: pw1 - 10 * MM, lh: 1.4 });
      var px2 = m + pw1 + 4 * MM;
      [["Ежемесячно 5 лет", "около " + rub(D.pay5), "в месяц. Самый короткий срок"], ["Пожизненно", "Каждый месяц всю жизнь", "Размер рассчитает фонд, когда станут доступны выплаты"]].forEach(function (c, i) {
        var cx2 = px2 + i * (pw2 + 4 * MM); rr(cx2, y, pw2, ph, 5 * MM, C.card);
        T(c[0], cx2 + 5 * MM, y + 6 * MM, { size: 9, color: C.muted });
        var vs = i === 0 ? 17 : 13; while (tw(c[1].split(" ").slice(0, 2).join(" "), vs, true) > pw2 - 10 * MM && vs > 10) vs -= 0.5;
        var yy3 = T(c[1], cx2 + 5 * MM, y + 6 * MM + 16, { size: vs, bold: true, maxW: pw2 - 10 * MM, lh: 1.1 });
        T(c[2], cx2 + 5 * MM, yy3 + 6, { size: 8.5, color: C.muted, maxW: pw2 - 10 * MM, lh: 1.4 });
      });
      y += ph + 2.5 * MM;
      y = T("Суммы без учёта дохода, который фонд продолжит начислять в период выплат", m, y, { size: 8, color: C.faint }) + 8 * MM;
      y = eyebrow("Что защищает ваши деньги", y, C.blue) + 4 * MM;
      var prot = [["asv", "Застрахованы до 2,8 млн ₽", "Агентство по страхованию вкладов, вдвое больше, чем по банковским вкладам"], ["shield", "Наследуются", "Все средства на счёте, включая господдержку и доход, получат ваши наследники"], ["plus", "Доступны в особых случаях", "При дорогостоящем лечении или потере кормильца до 100 % средств, без потери господдержки и дохода"], ["back", "Можно расторгнуть", "Выплачивается выкупная сумма. Она может быть меньше внесённого, особенно в первые годы"]];
      var qw = (W - 4 * MM) / 2, qh = 30 * MM;
      prot.forEach(function (p, i) {
        var qx = m + (i % 2) * (qw + 4 * MM), qy = y + Math.floor(i / 2) * (qh + 4 * MM), is = 14 * MM;
        rr(qx, qy, qw, qh, 5 * MM, C.card);
        if (p[0] === "asv") fitImg(D.img.asv, 1, qx + 5 * MM, qy + 5 * MM, is);
        else if (p[0] === "shield") fitImg(D.img.shield, D.img.shieldRatio, qx + 5 * MM, qy + 5 * MM, is);
        else { rr(qx + 5 * MM, qy + 5 * MM, is, is, 4 * MM, C.white); if (p[0] === "plus") icoPlus(qx + 5 * MM + is / 2, qy + 5 * MM + is / 2, is * 0.42, C.warm); else icoBack(qx + 5 * MM + is / 2, qy + 5 * MM + is / 2, is * 0.46, C.muted); }
        var qtx = qx + 5 * MM + is + 4 * MM, qtw = qx + qw - 5 * MM - qtx;
        var yy4 = T(p[1], qtx, qy + 5 * MM, { size: 11, bold: true, maxW: qtw, lh: 1.2 });
        T(p[2], qtx, yy4 + 3, { size: 9, color: C.muted, maxW: qtw, lh: 1.42 });
      });
      y += qh * 2 + 4 * MM + 9 * MM;
      y = eyebrow("Частые вопросы", y, C.blue) + 4 * MM;
      var faq = [["Можно пропустить месяц?", "Да. Обязательных платежей нет. Для господдержки за год достаточно внести от 2 000 ₽"], ["Что если изменится доход?", "Господдержку считают по доходу за каждый год. Взнос можно увеличить или уменьшить"], ["Уже есть пенсионные накопления?", "Накопления ОПС можно перевести в ПДС и начать не с нуля"]];
      var aw = (W - 8 * MM) / 3, ah = 34 * MM;
      faq.forEach(function (q, i) {
        var qx = m + i * (aw + 4 * MM); rrS(qx, y, aw, ah, 5 * MM, C.line, 0.8);
        var yy5 = T(q[0], qx + 5 * MM, y + 5 * MM, { size: 10.5, bold: true, maxW: aw - 10 * MM, lh: 1.22 });
        T(q[1], qx + 5 * MM, yy5 + 4, { size: 9, color: C.muted, maxW: aw - 10 * MM, lh: 1.42 });
      });
      foot();

      /* ---------- 7. следующий шаг ---------- */
      newPage();
      y = head("Следующий шаг", "Начните в этом году") + 7 * MM;
      var dh = 26 * MM; img(gradCard(W, dh, 5 * MM, [[0, "#FFE9DE"], [1, "#FFF6F1"]], 20), m, y, W, dh);
      if (D.img.hourglass) { var hgH = 16 * MM, hgW = hgH * (D.img.hourglassRatio || 0.6); img(D.img.hourglass, m + 6 * MM + (12 * MM - hgW) / 2, y + (dh - hgH) / 2, hgW, hgH); }
      var dtx = m + 23 * MM, dtw = W - 23 * MM - 34 * MM;
      var yy6 = T("Успейте до 31 декабря", dtx, y + 6 * MM, { size: 12.5, bold: true });
      T("Взносы от 2 000 ₽ в " + D.year + " году дают право на господдержку и налоговый вычет за этот год", dtx, yy6 + 3, { size: 9.5, color: C.ink2, maxW: dtw, lh: 1.4 });
      T(String(D.daysLeft), m + W - 17 * MM, y + 5.5 * MM, { size: 26, bold: true, color: C.warm, align: "center" });
      T(D.plural(D.daysLeft, ["день", "дня", "дней"]) + " на дату", m + W - 17 * MM, y + 5.5 * MM + 32, { size: 8.5, color: C.muted, align: "center" });
      T("расчёта", m + W - 17 * MM, y + 5.5 * MM + 43, { size: 8.5, color: C.muted, align: "center" });
      y += dh + 6 * MM;
      button(m, y, W, 19 * MM, "Оформить через Госуслуги", D.contractUrl, "кнопка активна, около 10 минут"); y += 19 * MM + 6 * MM;
      var hw = (W - 8 * MM) / 3, hh2 = 27 * MM;
      ["Войдите через Госуслуги, часть данных подставится сама", "Проверьте анкету и поставьте согласие", "Сделайте первый взнос и подключите автоплатёж"].forEach(function (s, i) {
        var hx = m + i * (hw + 4 * MM); rr(hx, y, hw, hh2, 5 * MM, C.card);
        dot(hx + 5 * MM + 10, y + 5 * MM + 10, 10, C.white); T(String(i + 1), hx + 5 * MM + 10, y + 5 * MM + 4.5, { size: 9.5, bold: true, align: "center" });
        T(s, hx + 5 * MM, y + 5 * MM + 27, { size: 9.5, color: C.ink2, maxW: hw - 10 * MM, lh: 1.42 });
      });
      y += hh2 + 6 * MM;
      var qh2 = 52 * MM; rr(m, y, W, qh2, 5 * MM, C.card);
      rr(m + 6 * MM, y + 6 * MM, 40 * MM, 40 * MM, 2 * MM, C.white); qr(m + 6 * MM + 3, y + 6 * MM + 3, 40 * MM - 6);
      var qtx2 = m + 53 * MM, qtw2 = W - 59 * MM;
      var yy7 = T("Расчёт на телефоне", qtx2, y + 9 * MM, { size: 13, bold: true });
      yy7 = T("Наведите камеру на код: откроется страница с калькулятором. Можно поменять взнос и посмотреть другие варианты", qtx2, yy7 + 4, { size: 9.5, color: C.muted, maxW: qtw2, lh: 1.42 });
      yy7 = T("8 800 700 75 50", qtx2, yy7 + 10, { size: 12, bold: true });
      T("звонок по России бесплатный", qtx2, yy7 + 1, { size: 9.5, color: C.muted });
      y += qh2 + 6 * MM;
      var fam = [["Покажите план близким.", 1], [" Открыть ПДС может каждый взрослый, и у каждого своя господдержка до 36 000 ₽ в год", 0]];
      var fh2 = RT(fam, 0, 0, { size: 9.5, maxW: W - 12 * MM, measure: true, lh: 1.42 }) + 10 * MM;
      rrS(m, y, W, fh2, 5 * MM, C.line, 0.8); RT(fam, m + 6 * MM, y + 5 * MM, { size: 9.5, maxW: W - 12 * MM, lh: 1.42 });
      y += fh2 + 6 * MM;
      T(disclaimer, m, y, { size: 7.6, color: C.faint, maxW: W, lh: 1.42 });
      foot();
    }

    /* ======================================================== PHONE */
    function ph() {
      var m = G.m, y, px = 0.75;
      /* ---------- 1. обложка ---------- */
      img(coverBg(G.w, G.h, true), 0, 0, G.w, G.h, "JPEG");
      top();
      y = eyebrow("Личный план · " + D.dateTxt, 120 * px) + 5;
      y = T("Ваш план «Цель миллион»", m, y, { size: 16.5, bold: true, color: C.ink2 }) + 10;
      var gs = 40.5, gw = tw(rub(V), gs, true) * 0.97; if (gw > W) gs = gs * W / gw;
      var g1 = gtext(rub(V), gs, m, y); y += g1.h + 6;
      y = T(D.whenTxt, m, y, { size: 14.25, color: C.ink2, maxW: 250, lh: 1.35 });
      if (D.img.column) { var cw = 187, ch = cw / (D.img.columnRatio || 0.5625); if (ch > 340) { ch = 340; cw = ch * (D.img.columnRatio || 0.5625); } img(D.img.column, G.w - 8 - cw, Math.max(y + 20, 322), cw, ch); }
      var cy = Math.max(y + 34, 390);
      D.chips.forEach(function (c) { var w = tw(c, 11.25, true) + 24; rr(m, cy, w, 26, 13, C.white); rrS(m, cy, w, 26, 13, C.line, 0.7); T(c, m + 12, cy + 7.3, { size: 11.25, bold: true }); cy += 33; });
      T("Листайте: откуда деньги, дорожная карта и первые шаги", G.w / 2, G.h - 38, { size: 9.75, color: C.muted, align: "center" });

      /* ---------- 2. откуда деньги ---------- */
      newPage();
      y = head("План на одной странице", "Откуда возьмутся " + D.shortRub(V) + NB + "₽");
      bar4(m, y + 18, W, 10.5); y += 36;
      src.forEach(function (s, i) {
        var rh = 70; fitImg(D.img.src[i], D.img.srcRatio[i], m, y + (rh - 42) / 2, 42);
        T(s.k, m + 54, y + 20, { size: 12, bold: true });
        T(s.dS, m + 54, y + 38, { size: 9.75, color: C.muted, maxW: W - 54 - 110 });
        T(s.v, m + W, y + rh / 2 - 7.5, { size: 14.25, bold: true, align: "right" });
        y += rh; hr(m, m + W, y);
      });
      y += 14;
      T("Итого " + full, m, y + 10, { size: 12, bold: true });
      var g2 = gradText(rub(V), 25.5); img(g2.url, m + W - g2.w, y, g2.w, g2.h); y += g2.h + 24;
      var rh3 = 118; img(gradCard(W, rh3, 16.5, [[0, "#EEF4FF"], [1, "#FFF1EA"]], 20), m, y, W, rh3);
      var rg = gradText(ratioTxt, 39); img(rg.url, m + 18, y + (rh3 - rg.h) / 2 + 2, rg.w, rg.h);
      var rtx = m + 18 + Math.max(rg.w, 80) + 12, rtw = m + W - 16 - rtx;
      var rruns = [["Каждый ваш рубль превращается примерно в ", 0], [ratioTxt.slice(1) + NB + "₽", 1], [". Без учёта дохода фонда это ", 0], [rub(D.noInc), 1]];
      var rth = RT(rruns, 0, 0, { size: 11.25, maxW: rtw, measure: true, lh: 1.45 });
      RT(rruns, rtx, y + (rh3 - rth) / 2, { size: 11.25, maxW: rtw, lh: 1.45 });

      /* ---------- 3. три даты ---------- */
      newPage();
      y = head("Три даты вашего плана", "Когда и сколько") + 22;
      var avail = G.h - 36 - y, bh = (avail - 24) / 3;
      var big = [
        [milWord, D.gYear ? String(D.gYear) : "40+ лет", C.blue, C.card, D.gIn + (D.gYear ? ", на счёте " + rub(D.target) + " и больше" : "")],
        ["Господдержка получена полностью", String(D.govTo), C.warm, C.card, "всего " + rub(D.cofinAll) + " за " + Math.max(0, D.govTo - D.govFrom + 1) + " " + D.plural(Math.max(0, D.govTo - D.govFrom + 1), ["год", "года", "лет"])],
        [D.now15 ? "Через 15 лет на счёте" : payWord(), D.now15 ? String(D.startYear + 15) : String(D.payYear), C.green, C.greenSoft, rub(V) + ", например около " + rub(D.pay10) + " в месяц 10 лет"]
      ];
      big.forEach(function (b) {
        rr(m, y, W, bh, 18, b[3]);
        var inner = 14 + 6 + 66 + 6 + TH(b[4], 11.25, W - 44, 1.35), ty = y + (bh - inner) / 2;
        ty = T(b[0], m + 22, ty, { size: 11.25, color: C.muted, maxW: W - 44 });
        T(b[1], m + 20, ty + 4, { size: 63, bold: true, color: b[2], cs: -1.5 });
        T(b[4], m + 22, ty + 4 + 72, { size: 11.25, color: C.ink2, maxW: W - 44, lh: 1.35 });
        y += bh + 12;
      });

      /* ---------- 4. дорожная карта ---------- */
      newPage();
      y = head("Дорожная карта", D.now15 ? "Год за годом" : "Год за годом до выплат", "Сумма на счёте в конце года") + 14;
      var Y = D.years, nH = Y.filter(function (r) { return r.cls && r.cls !== "gov"; }).length, avail2 = G.h - 30 - y;
      var rowN = 34.5, rowH = 44, need = (Y.length - nH) * rowN + nH * (rowH + 4);
      if (need > avail2) { var k = avail2 / need; rowN *= k; rowH *= k; }
      var lx = m + 52, ex = m + 66, ax = m + W, rowsY = [], yy = y;
      Y.forEach(function (r) { var hl = r.cls && r.cls !== "gov", h = hl ? rowH + 4 : rowN; rowsY.push([yy, h, hl]); yy += h; });
      tline(lx, y + 8, yy - 8, 1.5);
      Y.forEach(function (r, i) {
        var ry = rowsY[i][0], h = rowsY[i][1], hl = rowsY[i][2], mid = ry + h / 2, fin = r.cls.indexOf("fin") >= 0;
        if (hl) rr(m - 9, ry + 2, W + 18, h - 4, 12, fin ? C.greenSoft : C.card);
        T(String(r.y), m, mid - 6.4, { size: 12.75, bold: true, color: C.ink2 });
        if (hl) { var pc = fin ? C.green : C.blue; dot(lx, mid, 11, mix(pc, "#FFFFFF", 0.82)); dot(lx, mid, 7.5, pc); }
        else { dot(lx, mid, 5.3, r.cls === "gov" ? C.warm : C.blue); dot(lx, mid, 3.1, C.white); }
        var evTxt = (r.evB + r.ev).replace("Старт. Первые взносы до 31 декабря", "Старт. Взносы до 31 декабря").replace(/^Первая господдержка.*$/, "Первая господдержка").replace("Доход фонда за год больше господдержки", "Доход больше господдержки").replace("Последний год, за который начислят господдержку", "").replace("Выплаты доступны. Вы выбираете, как получать", "Выплаты доступны").replace(/^Господдержка получена полностью:.*$/, "Господдержка получена").replace("Господдержка за год ", "Господдержка ");
        var bEnd = r.evB ? Math.min(evTxt.length, r.evB.replace(/[.:]$/, "").length + 1) : 0;
        if (evTxt) RT([[evTxt.slice(0, bEnd), 1], [evTxt.slice(bEnd), 0]], ex, mid - 5.9, { size: 11, maxW: ax - ex - 78, color: C.muted, bcolor: C.ink, lh: 1.15 });
        T(rub(r.v), ax, mid - 6.3, { size: 12, bold: true, color: fin ? C.green : r.cls.indexOf("mil") >= 0 ? C.blue : C.ink, align: "right" });
      });

      /* ---------- 5. первый год ---------- */
      newPage();
      y = head("Первый год", "Что сделать и что получить") + 22;
      var F1 = D.fy, Y0 = D.startYear, Y1 = Y0 + 1;
      var st = [["Сегодня", C.blue, "Договор и первый взнос", "Через Госуслуги, около 10 минут", rub(D.first ? D.first + D.monthly : D.monthly)], ["Сразу", C.blue, "Автоплатёж", rub(D.monthly) + " в месяц, можно менять", rub(D.monthly)], ["31 дек", C.warm, "Взнос от 2 000 ₽ в " + Y0 + " году", "Право на господдержку и вычет за год", rub(F1.own0)], [String(Y1), C.warm2, "Налоговый вычет", "Заявление в ЛК налогоплательщика", "+ " + rub(F1.ded0)], [String(Y1), C.green, "Господдержка за " + Y0 + " год", "Придёт на счёт сама", "+ " + rub(F1.gov0)]];
      var avail3 = G.h - 40 - y, sh = Math.min(104, (avail3 - 4 * 10.5) / 5);
      st.forEach(function (s) {
        rr(m, y, W, sh, 16.5, C.card);
        var cs = 52, cy3 = y + (sh - cs) / 2; rr(m + 13.5, cy3, cs, cs, 12, C.white);
        fill(s[1]); doc.roundedRect(m + 13.5, cy3, cs, 7, 3.5, 3.5, "F"); doc.rect(m + 13.5, cy3 + 3.75, cs, 3.75, "F");
        var dsz = 11.25; while (tw(s[0], dsz, true) > cs - 6) dsz -= 0.5;
        T(s[0], m + 13.5 + cs / 2, cy3 + cs / 2 - 3, { size: dsz, bold: true, align: "center" });
        var aw2 = tw(s[4], 12.75, true), txx = m + 13.5 + cs + 11, txw = m + W - 13.5 - aw2 - 10 - txx;
        var hh = TH(s[2], 12.75, txw, 1.22, true) + 3 + TH(s[3], 10.9, txw, 1.38), ty2 = y + (sh - hh) / 2;
        ty2 = T(s[2], txx, ty2, { size: 12.75, bold: true, maxW: txw, lh: 1.22 });
        T(s[3], txx, ty2 + 3, { size: 10.9, color: C.muted, maxW: txw, lh: 1.38 });
        T(s[4], m + W - 13.5, y + sh / 2 - 6.4, { size: 12.75, bold: true, align: "right" });
        y += sh + 10.5;
      });

      /* ---------- 6. что если ---------- */
      newPage();
      y = head("Что если", "Другой взнос", "На счёте " + full) + 15;
      var S = D.scen, maxV = Math.max.apply(null, S.map(function (s) { return s.v; }));
      S.forEach(function (s) {
        var rh = 45; if (s.me) { rr(m, y, W, rh, 13.5, C.white); rrS(m + 0.75, y + 0.75, W - 1.5, rh - 1.5, 13.5, C.blue, 1.5); } else rr(m, y, W, rh, 13.5, C.card);
        T(rub(s.m), m + 12, y + rh / 2 - 5.6, { size: 11.25, color: C.ink2, bold: s.me });
        var bx = m + 12 + 64 + 9, bmax = W - 12 - 64 - 9 - 9 - 68 - 12, bw = Math.max(8, s.v / maxV * bmax);
        img(gradCard(bw, 25.5, 6.75, [[0, C.blue], [1, C.sky]], 0), bx, y + (rh - 25.5) / 2, bw, 25.5);
        T(D.shortRub(s.v), m + W - 12, y + rh / 2 - 6.8, { size: 13.5, bold: true, align: "right" });
        y += rh + 7.5;
      });
      y += 4;
      var pl = [["в месяц к взносу дают ", 0], ["+" + rub(D.plus.add), 1], [" " + full, 0]].concat(D.plus.sooner ? [[" и " + (D.mil ? "миллион" : "цель") + " ", 0], [D.plus.sooner, 1]] : []);
      var plh = RT(pl, 0, 0, { size: 12.75, maxW: W - 30, measure: true, lh: 1.4 }) + 30 + 34;
      rr(m, y, W, plh, 16.5, C.blueSoft);
      T("+1 000 ₽", m + 15, y + 15, { size: 30, bold: true, color: C.blue, cs: -0.6 });
      RT(pl, m + 15, y + 15 + 38, { size: 12.75, maxW: W - 30, lh: 1.4 });
      y += plh + 22;
      y = T("Если доходность будет ниже", m, y, { size: 16.5, bold: true }) + 4;
      y = T("Доход фонда не гарантирован. Взнос " + rub(D.monthly) + ", " + (D.now15 ? "15 лет" : D.yrs.replace("через ", "")), m, y, { size: 10.5, color: C.muted, maxW: W }) + 12;
      var yMax = D.yields[0].v, rows6 = D.yields.map(function (q, i) { return [(q.r * 100) + " % годовых" + (i === 0 ? " · ваш план" : ""), q.v, i === 0 ? 1 : i === 1 ? 0.8 : 0.6]; }).concat([["Без дохода фонда", D.noInc, -1]]);
      var lw6 = 97, vw6 = 82, tk6 = m + lw6 + 8, tw6 = W - lw6 - vw6 - 16;
      rows6.forEach(function (r) {
        T(r[0], m, y + 1, { size: 10.5, bold: true, color: C.ink2, maxW: lw6, lh: 1.15 });
        rr(tk6, y + 2, tw6, 13.5, 4.5, C.card);
        var bw2 = Math.max(6, r[1] / yMax * tw6);
        if (r[2] > 0) img(gradCard(bw2, 13.5, 4.5, [[0, mix(C.blue, "#FFFFFF", 1 - r[2])], [1, mix(C.sky, "#FFFFFF", 1 - r[2])]], 0), tk6, y + 2, bw2, 13.5);
        else { rr(tk6, y + 2, bw2, 13.5, 4.5, C.hatch); stroke("#C7C7CC"); doc.setLineWidth(1); for (var hx = tk6 + 3; hx < tk6 + bw2 - 2; hx += 5) doc.line(hx, y + 14, Math.min(hx + 5, tk6 + bw2 - 2), y + 3.5); }
        T(rub(r[1]), m + W, y + 2.5, { size: 12.75, bold: true, align: "right" });
        y += 34;
      });

      /* ---------- 7. выплаты и защита ---------- */
      newPage();
      y = head("Выплаты и защита", "Как получать и что защищает") + 20;
      var pH = 118; img(gradCard(W, pH, 18, [[0, "#0B5CFF"], [1, "#6B5BFF"]], 60), m, y, W, pH);
      T("Ежемесячно 10 лет", m + 19.5, y + 19.5, { size: 11.25, color: "#DCE6FF" });
      T("около " + rub(D.pay10) + " в месяц", m + 19.5, y + 38, { size: 22, bold: true, color: C.white, maxW: W - 39 });
      T("или от 5 лет, или пожизненно. Без учёта дохода в период выплат", m + 19.5, y + 72, { size: 10.5, color: "#DCE6FF", maxW: W - 39, lh: 1.38 });
      y += pH + 10.5;
      var gw2 = (W - 9) / 2, gh2 = 108;
      [["asv", "До 2,8 млн ₽", " застраховано АСВ"], ["shield", "Наследуются", " все средства на счёте"], ["plus", "Досрочно", " при дорогостоящем лечении или потере кормильца"], ["back", "Расторжение:", " выкупная сумма, может быть меньше внесённого"]].forEach(function (p, i) {
        var qx = m + (i % 2) * (gw2 + 9), qy = y + Math.floor(i / 2) * (gh2 + 9), is = 33;
        rr(qx, qy, gw2, gh2, 15, C.card);
        if (p[0] === "asv") fitImg(D.img.asv, 1, qx + 13.5, qy + 13.5, is);
        else if (p[0] === "shield") fitImg(D.img.shield, D.img.shieldRatio, qx + 13.5, qy + 13.5, is);
        else { rr(qx + 13.5, qy + 13.5, is, is, 9, C.white); if (p[0] === "plus") icoPlus(qx + 13.5 + is / 2, qy + 13.5 + is / 2, is * 0.42, C.warm); else icoBack(qx + 13.5 + is / 2, qy + 13.5 + is / 2, is * 0.46, C.muted); }
        RT([[p[1], 1], [p[2], 0]], qx + 13.5, qy + 13.5 + is + 8, { size: 10.5, maxW: gw2 - 27, color: C.muted, lh: 1.38 });
      });
      y += gh2 * 2 + 9 + 22;
      y = T("Частые вопросы", m, y, { size: 16.5, bold: true }) + 10;
      [["Можно пропустить месяц?", "Да. Для господдержки достаточно от 2 000 ₽ за год"], ["Что если изменится доход?", "Господдержку считают по доходу за каждый год"], ["Есть накопления ОПС?", "Их можно перевести в ПДС и начать не с нуля"]].forEach(function (q) {
        var qh3 = 12 + 13.5 + 3 + TH(q[1], 10.5, W - 27, 1.35) + 12;
        rrS(m, y, W, qh3, 13.5, C.line, 0.8);
        var yq = T(q[0], m + 13.5, y + 12, { size: 11.25, bold: true });
        T(q[1], m + 13.5, yq + 3, { size: 10.5, color: C.muted, maxW: W - 27, lh: 1.35 });
        y += qh3 + 7.5;
      });

      /* ---------- 8. следующий шаг ---------- */
      newPage();
      y = head("Следующий шаг", "Начните в этом году") + 21;
      var dh = 92; img(gradCard(W, dh, 16.5, [[0, "#FFE9DE"], [1, "#FFF6F1"]], 20), m, y, W, dh);
      if (D.img.hourglass) { var hgH = 42, hgW = hgH * (D.img.hourglassRatio || 0.6); img(D.img.hourglass, m + 15 + (33 - hgW) / 2, y + (dh - hgH) / 2, hgW, hgH); }
      var dtx = m + 15 + 33 + 10.5, dtw = W - (dtx - m) - 64;
      var dyy = T("Успейте до 31 декабря", dtx, y + 16, { size: 12.75, bold: true });
      T("Взносы от 2 000 ₽ в " + D.year + " году дают господдержку и вычет за этот год", dtx, dyy + 3, { size: 10.5, color: C.ink2, maxW: dtw, lh: 1.38 });
      T(String(D.daysLeft), m + W - 32, y + dh / 2 - 22, { size: 27, bold: true, color: C.warm, align: "center" });
      T(D.plural(D.daysLeft, ["день", "дня", "дней"]), m + W - 32, y + dh / 2 + 10, { size: 9.75, color: C.muted, align: "center" });
      y += dh + 16.5;
      button(m, y, W, 54, "Оформить через Госуслуги", D.contractUrl); y += 54 + 16.5;
      ["Войдите через Госуслуги, данные подставятся", "Проверьте анкету и поставьте согласие", "Первый взнос и автоплатёж"].forEach(function (s, i) {
        dot(m + 12, y + 12, 12, C.card); T(String(i + 1), m + 12, y + 5.8, { size: 11.25, bold: true, align: "center" });
        T(s, m + 33, y + 5, { size: 11.25, color: C.ink2, maxW: W - 33 }); y += 31.5;
      });
      y += 6;
      rr(m, y, W, 46, 23, C.card); T("Открыть расчёт на сайте", G.w / 2, y + 15.5, { size: 12.75, bold: true, color: C.blue, align: "center" });
      if (window.__PDF_QR) doc.link(m, y, W, 46, { url: window.__PDF_QR.url });
      y += 46 + 12;
      T("8 800 700 75 50 · бесплатно по России", G.w / 2, y, { size: 11.25, color: C.muted, align: "center" });
      y += 26;
      var fam = [["Перешлите план близким.", 1], [" У каждого взрослого своя господдержка до 36 000 ₽ в год", 0]];
      var fh = RT(fam, 0, 0, { size: 11.25, maxW: W - 30, measure: true, lh: 1.42 }) + 27;
      rrS(m, y, W, fh, 15, C.line, 0.8); RT(fam, m + 15, y + 13.5, { size: 11.25, maxW: W - 30, lh: 1.42 });
      var dH = TH(disclaimer, 7.4, W, 1.38);
      T(disclaimer, m, G.h - 18 - dH, { size: 7.4, color: C.faint, maxW: W, lh: 1.38 });
    }

    fill(C.white); doc.rect(0, 0, G.w, G.h, "F");
    if (phone) ph(); else a4();
    return doc.output("blob");
  }
})();
