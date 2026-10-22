/* =====================================================================
   «Цель миллион» · личный план ПДС в PDF, v16 — в дизайн-коде ГАЗФОНД ПН.
   ТЗ-v16, раздел 7: цвета только из токенов кита, шрифт Inter, радиусы кита,
   3D-картинки из kit/assets/3d, поля 48 pt, фон страниц чередуется
   (обложка — синий градиент героя, дальше белый и fill_1).
   Два макета из одних данных (planData() в странице):
   · a4    — 7 страниц A4, альбомная ориентация, для компьютера и печати;
   · phone — экраны 360×780 pt, блоки идут подряд и сами переносятся на новый экран.
   window.buildPlanPdf(D, mode) → Promise<Blob>
   ===================================================================== */
(function () {
  "use strict";
  /* токены kit/tokens/tokens.json */
  var C = {
    dark: "#1C1F35", gray1: "#7D7D7D", gray2: "#BEBEBE", blue: "#0051FF", blue2: "#006FFF", blue3: "#67A9FF",
    blueQ: "#11428F", dblue: "#283069", lblue: "#94E6FF", orange: "#FF7D4A", f1: "#F4F5FF", f2: "#FFFFFF", f3: "#EBECF7",
    line: "#E6E6E6", heroA: "#0063FF", heroB: "#52A8FF"
  };
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return "#" + [0, 1, 2].map(function (i) { return ("0" + Math.round(x[i] + (y[i] - x[i]) * t).toString(16)).slice(-2); }).join(""); }
  /* white_70 и white_50 кита на синем фоне героя */
  C.w70 = mix(C.f2, "#2A86FF", 0.3); C.w50 = mix(C.f2, "#2A86FF", 0.5);

  /* градиент героя кита (#0063FF → #52A8FF по диагонали) — картинкой через canvas */
  function heroImg(w, h, r) {
    var k = 2, c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    var x = c.getContext("2d"), g = x.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, C.heroA); g.addColorStop(1, C.heroB);
    x.fillStyle = g;
    if (r) { var R = r * k, W = c.width, H = c.height; x.beginPath(); x.moveTo(R, 0); x.arcTo(W, 0, W, H, R); x.arcTo(W, H, 0, H, R); x.arcTo(0, H, 0, 0, R); x.arcTo(0, 0, W, 0, R); x.closePath(); x.fill(); return c.toDataURL("image/png"); }
    x.fillRect(0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.92);
  }

  window.buildPlanPdf = function (D, mode) { return Promise.resolve().then(function () { return build(D, mode); }); };

  function build(D, mode) {
    var jsPDF = window.jspdf.jsPDF, phone = mode === "phone";
    var G = phone ? { w: 360, h: 780, m: 24 } : { w: 841.89, h: 595.28, m: 48 };
    var W = G.w - 2 * G.m, GAP = phone ? 12 : 16, BOTTOM = G.h - (phone ? 40 : 64);
    var doc = new jsPDF({ unit: "pt", format: [G.w, G.h], orientation: phone ? "portrait" : "landscape", compress: true });
    doc.addFileToVFS("Inter-500.ttf", window.__PDF_FONT_500); doc.addFont("Inter-500.ttf", "Inter", "normal");
    doc.addFileToVFS("Inter-700.ttf", window.__PDF_FONT_700); doc.addFont("Inter-700.ttf", "Inter", "bold");
    doc.setProperties({ title: "Личный план · Цель миллион", subject: "Предварительный расчёт программы долгосрочных сбережений", author: "АО «НПФ ГАЗФОНД пенсионные накопления»", creator: "ГАЗФОНД ПН" });
    var rub = D.rub, NB = " ", plural = D.plural;

    /* ---------- примитивы; при DRAW = false только меряют высоту ---------- */
    var DRAW = true, pageNo = 0, bg = C.f2, card = C.f1;
    function fill(c) { var a = hex(c); doc.setFillColor(a[0], a[1], a[2]); }
    function stroke(c) { var a = hex(c); doc.setDrawColor(a[0], a[1], a[2]); }
    function color(c) { var a = hex(c); doc.setTextColor(a[0], a[1], a[2]); }
    function font(size, bold) { doc.setFont("Inter", bold ? "bold" : "normal"); doc.setFontSize(size); }
    function tw(s, size, bold) { font(size, bold); return doc.getTextWidth(String(s)); }
    function lines(str, size, bold, maxW) { font(size, bold); return maxW ? doc.splitTextToSize(String(str), maxW) : [String(str)]; }
    function T(str, x, y, o) {
      o = o || {}; var size = o.size || 11, lh = size * (o.lh || 1.3), ls = lines(str, size, o.bold, o.maxW);
      if (DRAW) { color(o.color || C.dark); ls.forEach(function (ln, i) { doc.text(ln, x, y + size * 0.8 + i * lh, { align: o.align || "left" }); }); }
      return y + ls.length * lh;
    }
    function TH(str, o) { var d = DRAW; DRAW = false; var h = T(str, 0, 0, o); DRAW = d; return h; }
    /* текст с жирными кусками: [[«обычный», 0], [«жирный», 1]] */
    function RT(runs, x, y, o) {
      var size = o.size || 11, lh = size * (o.lh || 1.35), maxW = o.maxW, toks = [];
      runs.forEach(function (r) { String(r[0]).split(/( +)/).forEach(function (t) { if (t) toks.push([t, !!r[1]]); }); });
      var ls = [[]], cw = 0;
      toks.forEach(function (t) { var w = tw(t[0], size, t[1]); if (cw + w > maxW && ls[ls.length - 1].length && t[0].trim()) { ls.push([]); cw = 0; if (!t[0].trim()) return; } ls[ls.length - 1].push([t[0], t[1], w]); cw += w; });
      if (DRAW) ls.forEach(function (ln, i) { var cx = x; ln.forEach(function (t) { font(size, t[1]); color(t[1] ? (o.bcolor || C.dark) : (o.color || C.gray1)); doc.text(t[0], cx, y + size * 0.8 + i * lh); cx += t[2]; }); });
      return y + ls.length * lh;
    }
    function RTH(runs, o) { var d = DRAW; DRAW = false; var h = RT(runs, 0, 0, o); DRAW = d; return h; }
    function rr(x, y, w, h, r, c) { if (!DRAW) return; fill(c); var k = Math.min(r, h / 2, w / 2); doc.roundedRect(x, y, w, h, k, k, "F"); }
    function rrS(x, y, w, h, r, c, lw) { if (!DRAW) return; stroke(c); doc.setLineWidth(lw || 1); var k = Math.min(r, h / 2, w / 2); doc.roundedRect(x, y, w, h, k, k, "S"); }
    function hr(x1, x2, y, c) { if (!DRAW) return; stroke(c || C.line); doc.setLineWidth(0.75); doc.line(x1, y, x2, y); }
    function dot(x, y, r, c) { if (!DRAW) return; fill(c); doc.circle(x, y, r, "F"); }
    function img(url, x, y, w, h, fmt) { if (DRAW && url) try { doc.addImage(url, fmt || "PNG", x, y, w, h, undefined, "FAST"); } catch (e) {} }
    function fit(name, x, y, box) { var u = D.img[name], r = D.img[name + "Ratio"] || 1; if (!u) return; var w = box, h = box; if (r > 1) h = box / r; else w = box * r; img(u, x + (box - w) / 2, y + (box - h) / 2, w, h); }
    function link(x, y, w, h, url) { if (DRAW && url) doc.link(x, y, w, h, { url: url }); }

    /* ---------- страница: шапка с логотипом на синей плашке, заголовок, подвал ---------- */
    var TOTAL = 0;
    function newDocPage() { if (pageNo > 0) doc.addPage([G.w, G.h]); pageNo++; }
    function paintBg(c) { bg = c; card = c === C.f2 ? C.f1 : C.f2; fill(c); doc.rect(0, 0, G.w, G.h, "F"); }
    function logoTile(x, y, h) {
      var w = h * 1.7; img(heroImg(w, h, 12), x, y, w, h);
      if (D.img.logo) { var lh = h - 12, lw = lh * (D.img.logoRatio || 1.54); img(D.img.logo, x + (w - lw) / 2, y + 6, lw, lh); }
      return w;
    }
    function header() {
      var h = phone ? 34 : 40; logoTile(G.m, G.m - (phone ? 6 : 14), h);
      T("Личный план · " + D.dateTxt, G.w - G.m, G.m - (phone ? 6 : 14) + h / 2 - 5, { size: phone ? 9 : 9.5, color: C.gray1, align: "right" });
      return G.m - (phone ? 6 : 14) + h;
    }
    var foots = [];
    function footer() { foots.push(pageNo); }
    function drawFooters() {
      foots.forEach(function (n) {
        doc.setPage(n);
        var y = G.h - (phone ? 24 : 36);
        hr(G.m, G.w - G.m, y - 8);
        T(n === TOTAL ? "АО «НПФ ГАЗФОНД пенсионные накопления» · лицензия Банка России № 430" : "Цель миллион · личный план", G.m, y - 2, { size: 8, color: C.gray1 });
        T(n + " / " + TOTAL, G.w - G.m, y - 2, { size: 8, color: C.gray1, align: "right" });
      });
    }
    var y = 0, curBg = C.f2, curHead = null;
    function page(bgc, over, title, sub) {
      newDocPage(); paintBg(bgc); curBg = bgc; curHead = [over, title];
      y = header() + (phone ? 24 : 22);
      y = T(over, G.m, y, { size: phone ? 10 : 10.5, color: C.blue }) + 6;
      y = T(title, G.m, y, { size: phone ? 24 : 28, maxW: W, lh: 1.15 });
      if (sub) y = T(sub, G.m, y + 6, { size: phone ? 11 : 12, color: C.gray1, maxW: phone ? W : W * 0.7, lh: 1.4 });
      y += phone ? 20 : 22;
      footer();
      return y;
    }
    /* на телефоне блок, который не помещается, уходит на следующий экран с тем же фоном */
    function need(h) {
      if (y + h <= BOTTOM) return;
      newDocPage(); paintBg(curBg); footer();
      y = header() + 24;
      y = T(curHead[1] + " · продолжение", G.m, y, { size: 10.5, color: C.blue }) + 16;
    }
    /* блок: draw(x, y, w) → нижняя граница; меряется тем же кодом без рисования */
    function measure(fn, w) { var d = DRAW; DRAW = false; var b = fn(0, 0, w); DRAW = d; return b; }
    function place(fn, w, x) { var h = measure(fn, w); if (phone) need(h); var b = fn(x == null ? G.m : x, y, w); y = b + GAP; return b; }

    /* ---------- общие данные ---------- */
    var hp = D.hp, V = D.V, hg = D.hg || hp, goal = !!D.g, Y0 = D.startYear, Y1 = Y0 + 1;
    var goalWord = D.mil ? "Миллион" : "Цель";
    var disclaimer = "Расчёт предварительный и не является гарантией дохода. Доходность 10 % годовых взята для примера, доход от фонда не гарантирован. Господдержка до 36 000 ₽ в год в первые 10 лет при взносах от 2 000 ₽ в год, размер зависит от официального дохода. Налоговый вычет от 13 до 22 % от взносов (не более чем с 400 000 ₽ в год) возвращает ФНС по вашему заявлению, в расчёте взято 13 %. Выплаты по общему правилу доступны через 15 лет действия договора либо с 55 лет женщинам и 60 лет мужчинам. При досрочном расторжении выплачивается выкупная сумма, она может быть меньше внесённого. Средства застрахованы АСВ на сумму до 2,8 млн ₽. " + D.paramsTxt;
    var src = [
      ["Ваши взносы", hg.contrib, C.dblue, ""], ["Господдержка", hg.cofin, C.blue, "+ "],
      ["Налоговый вычет", hg.ded, C.blue3, "+ "], ["Доход от фонда", hg.inc, C.lblue, "+ "]
    ];
    function coinSplit(h) {
      var tot = h.value || 1, you = Math.max(1, Math.min(10, Math.round(h.contrib / tot * 10))), rest = 10 - you;
      var parts = [[h.cofin, C.blue], [h.ded, C.blue3], [h.inc, C.lblue]], sum = h.cofin + h.ded + h.inc || 1;
      parts.forEach(function (p) { p.ex = p[0] / sum * rest; p.n = Math.floor(p.ex); });
      var left = rest - parts.reduce(function (a, p) { return a + p.n; }, 0);
      parts.slice().sort(function (a, b) { return (b.ex - b.n) - (a.ex - a.n); }).forEach(function (p) { if (left > 0 && p[0] > 0) { p.n++; left--; } });
      var out = []; for (var i = 0; i < you; i++) out.push(C.dblue);
      parts.forEach(function (p) { for (var j = 0; j < p.n; j++) out.push(p[1]); });
      while (out.length < 10) out.push(C.blue);
      return { you: you, rest: rest, cols: out };
    }

    /* ======================= 1. ОБЛОЖКА: синий градиент героя ======================= */
    newDocPage(); bg = C.blue; curBg = C.blue;
    img(heroImg(G.w, G.h, 0), 0, 0, G.w, G.h, "JPEG");
    if (D.img.logo) { var lh0 = phone ? 40 : 48; img(D.img.logo, G.m, G.m - 8, lh0 * (D.img.logoRatio || 1.54), lh0); }
    T(D.dateTxt, G.w - G.m, G.m + 6, { size: 9.5, color: C.w70, align: "right" });
    var imgBox = phone ? 200 : 300;
    if (phone) { fit("cover", G.w - G.m - imgBox + 20, 92, imgBox); y = 92 + imgBox + 8; }
    else { fit("cover", G.w - G.m - imgBox, (G.h - imgBox) / 2 - 10, imgBox); y = 168; }
    var cw = phone ? W : W - imgBox - 24;
    y = T("Ваш план «Цель миллион»", G.m, y, { size: phone ? 12 : 13, color: C.lblue }) + 10;
    var big = goal ? rub(D.target) : rub(V), bs = phone ? 44 : 64; while (tw(big, bs, true) > cw && bs > 30) bs -= 1;
    y = T(big, G.m, y, { size: bs, bold: true, color: C.f2, lh: 1.05 }) + 6;
    y = T(goal ? "на счёте " + D.gIn + ", в " + D.gYear + " году" : D.whenTxt, G.m, y, { size: phone ? 18 : 22, color: C.f2, maxW: cw, lh: 1.2 }) + 12;
    y = T("При взносе " + rub(D.monthly) + " в месяц" + (D.first ? " и стартовом взносе " + rub(D.first) : "") + ". " + (D.now15 ? "Через 15 лет" : "Когда станут доступны выплаты, в " + D.payYear + " году,") + " на счёте будет около " + rub(V), G.m, y, { size: phone ? 11 : 12, color: C.w70, maxW: Math.min(cw, 400), lh: 1.45 }) + 20;
    var cx = G.m, cy = y, chH = phone ? 26 : 28;
    D.chips.forEach(function (c) { var w = tw(c, 10, true) + 28; if (cx + w > G.m + cw) { cx = G.m; cy += chH + 8; } rr(cx, cy, w, chH, chH / 2, C.f2); T(c, cx + 14, cy + chH / 2 - 6, { size: 10, bold: true, color: C.dblue }); cx += w + 8; });
    T("Расчёт предварительный, доход от фонда не гарантирован · АО «НПФ ГАЗФОНД пенсионные накопления», лицензия № 430", G.m, G.h - G.m + (phone ? 4 : 8), { size: 8, color: C.w70, maxW: W });

    /* ======================= 2. ИЗ ЧЕГО СЛОЖИТСЯ ЦЕЛЬ: три числа ======================= */
    var co = coinSplit({ value: hg.value, contrib: hg.contrib, cofin: hg.cofin, ded: hg.ded, inc: hg.inc });
    page(C.f2, "Из чего сложится " + (goal ? (D.mil ? "миллион" : "цель") : "сумма"), goal ? "Откуда возьмётся " + D.goalTxt : "Откуда возьмётся " + rub(V),
      goal ? "Главное о вашем плане в трёх числах" : "Главное о вашем плане к моменту выплат");
    var pills = goal
      ? [["Ваши взносы до " + (D.mil ? "миллиона" : "цели"), rub(hg.contrib), C.dark], ["Программа добавит", "+ " + rub(hg.value - hg.contrib), C.blue], [goalWord + " на счёте", D.gIn, C.dblue]]
      : [["Ваши взносы", rub(hp.contrib), C.dark], ["Программа добавит", "+ " + rub(hp.add), C.blue], ["К выплатам в " + D.payYear, rub(V), C.dblue]];
    var pn = phone ? 1 : 3, pw = (W - GAP * (pn - 1)) / pn, ph = phone ? 68 : 80, pp = phone ? 24 : 32;
    function pillsBlock(x, yy, w) {
      pills.forEach(function (p, i) {
        var px = phone ? x : x + i * (pw + GAP), py = phone ? yy + i * (ph + 10) : yy, wdt = phone ? w : pw;
        rr(px, py, wdt, ph, ph / 2, C.f1);
        var ls = 10.5; while (tw(p[0], ls) > wdt - 2 * pp && ls > 8) ls -= 0.5;
        T(p[0], px + pp, py + (phone ? 14 : 18), { size: ls, color: C.gray1 });
        var vs = phone ? 22 : 26; while (tw(p[1], vs, true) > wdt - 2 * pp && vs > 14) vs -= 1;
        T(p[1], px + pp, py + (phone ? 30 : 36), { size: vs, bold: true, color: p[2] });
      });
      return yy + (phone ? 3 * ph + 20 : ph);
    }
    place(pillsBlock, W);
    function coinsBlock(x, yy, w) {
      var n = 10, cg = phone ? 5 : 10, cd = Math.min(phone ? 26 : 34, (w - cg * 9) / n);
      yy = T("Из каждых 10 ₽ на счёте", x, yy, { size: phone ? 13 : 14, color: C.dark }) + 10;
      co.cols.forEach(function (c, i) {
        var ccx = x + i * (cd + cg) + cd / 2, ccy = yy + cd / 2; dot(ccx, ccy, cd / 2, c);
        T("₽", ccx, ccy - cd * 0.2, { size: cd * 0.4, bold: true, color: c === C.lblue ? C.dblue : C.f2, align: "center" });
      });
      yy += cd + 10;
      yy = RT([[String(co.you), 1], [" " + "внесёте вы, ", 0], [String(co.rest), 1], [" добавит программа: господдержка, налоговый вычет и доход фонда", 0]], x, yy, { size: phone ? 11 : 11.5, maxW: w, color: C.gray1, bcolor: C.dark }) + 14;
      var sn = phone ? 2 : 4, sw = (w - GAP * (sn - 1)) / sn;
      src.forEach(function (s, i) {
        var sx = x + (i % sn) * (sw + GAP), sy = yy + Math.floor(i / sn) * 42;
        dot(sx + 4, sy + 6, 4, s[2]); T(s[0], sx + 14, sy, { size: 10, color: C.gray1 });
        T(s[3] + rub(s[1]), sx, sy + 16, { size: phone ? 15 : 16, bold: true, color: C.dark });
      });
      return yy + Math.ceil(4 / sn) * 42 - 8;
    }
    y += phone ? 6 : 12; place(coinsBlock, W);
    function afterBlock(x, yy, w) {
      var h = phone ? 92 : 60, tx = x + 20, tw2 = w - 40 - (phone ? 0 : 220);
      rr(x, yy, w, h, 16, C.f1);
      T(goal ? "Дальше счёт продолжает расти" : "Сумма к выплатам", tx, yy + 14, { size: 12.5, bold: true, color: C.dark, maxW: tw2 });
      T(D.now15 ? "Через 15 лет на счёте будет около" : "Когда станут доступны выплаты, в " + D.payYear + " году, на счёте будет около", tx, yy + 32, { size: 10.5, color: C.gray1, maxW: phone ? w - 40 : tw2 });
      T(rub(V), phone ? tx : x + w - 20, phone ? yy + 62 : yy + h / 2 - 12, { size: phone ? 18 : 24, bold: true, color: C.blue, align: phone ? "left" : "right" });
      return yy + h;
    }
    if (goal) place(afterBlock, W);

    /* ======================= 3. ГОД ЗА ГОДОМ: таблица на одной сетке ======================= */
    page(C.f1, "Дорожная карта", D.now15 ? "Год за годом" : "Год за годом до выплат", "Сумма на счёте в конце каждого года" + (D.now15 ? "" : " и в момент, когда станут доступны выплаты") + ". Господдержка за год приходит в следующем году. Отмечайте пройденные годы");
    var Yr = D.years, avail = BOTTOM - y - 46, rowH = phone ? 34 : Math.max(16, Math.min(26, avail / Math.max(1, Yr.length)));
    function yearsBlock(x, yy, w, from, to) {
      var rows = Yr.slice(from, to), h = 14 + 22 + rows.length * rowH + 8;
      rr(x, yy, w, h, 20, C.f2);
      var c1 = x + 20, c2 = x + (phone ? 64 : 96), c3 = x + w - (phone ? 40 : 64), ck = x + w - (phone ? 30 : 44);
      T("Год", c1, yy + 14, { size: 9, color: C.gray1 }); T("Что происходит", c2, yy + 14, { size: 9, color: C.gray1 }); T("На счёте", c3, yy + 14, { size: 9, color: C.gray1, align: "right" });
      var ry = yy + 14 + 22;
      rows.forEach(function (r) {
        var hl = r.cls && r.cls !== "gov", fin = r.cls && r.cls.indexOf("fin") >= 0;
        if (hl) rr(x + 8, ry + 1, w - 16, rowH - 2, 8, fin ? C.f3 : C.f1); else hr(c1, x + w - 20, ry, C.f3);
        var mid = ry + rowH / 2;
        T(String(r.y), c1, mid - 6, { size: 10.5, bold: true, color: C.dark });
        var ev = (r.evB || "") + (r.ev || "");
        if (ev) T(ev.replace(/\.\s*$/, ""), c2, mid - (phone ? 11 : 6), { size: phone ? 9.5 : 10, bold: hl, color: hl ? C.dark : C.gray1, maxW: c3 - c2 - (phone ? 70 : 110), lh: 1.15 });
        T(rub(r.v), c3, mid - 6.5, { size: hl ? 12 : 10.5, bold: true, color: hl ? C.blue : C.dark, align: "right" });
        rrS(ck, mid - 6, 12, 12, 3, C.gray2, 0.9);
        ry += rowH;
      });
      return yy + h;
    }
    if (phone) {
      var yi = 0;
      while (yi < Yr.length) {
        var per = Math.max(3, Math.floor((BOTTOM - y - 64) / rowH)), ya = yi, yb = Math.min(Yr.length, yi + per);
        place(function (x, yy, w) { return yearsBlock(x, yy, w, ya, yb); }, W); yi = yb;
        if (yi < Yr.length) { newDocPage(); paintBg(curBg); footer(); y = header() + 24; }
      }
    }
    else place(function (x, yy, w) { return yearsBlock(x, yy, w, 0, Yr.length); }, W);

    /* ======================= 4. ПЕРВЫЙ ГОД: даты текстом, по одной фразе ======================= */
    page(C.f2, "Первый год", "Что сделать и что получить", "Первые шаги, после которых план работает сам");
    var F1 = D.fy, steps = [
      ["Сегодня", rub(D.first ? D.first + D.monthly : D.monthly), "Оформить договор и сделать первый взнос", "Через Госуслуги, часть данных подставится сама"],
      ["Каждый месяц", rub(D.monthly), "Подключить автоплатёж", "Например, на следующий день после зарплаты. Сумму можно менять"],
      ["До 31 декабря " + Y0, rub(F1.own0), "Внести от 2 000 ₽ за " + Y0 + " год", F1.own0 < 2000 ? "Добавьте до 2 000 ₽, чтобы получить господдержку за год" : "Это право на господдержку и вычет за " + Y0 + " год"],
      ["С 1 января " + Y1, "+ " + rub(F1.ded0), "Оформить вычет за " + Y0 + " год", "В личном кабинете налогоплательщика" + (D.reinvest ? ", затем внести его на счёт" : "")],
      ["В течение " + Y1 + " года", "+ " + rub(F1.gov0), "Господдержка придёт на счёт", "Делать ничего не нужно, фонд всё оформит сам"]
    ];
    if (D.govTo > Y1) steps.push(["Каждый год до " + D.govTo, "+ " + rub(F1.gov1 + F1.ded1), F1.ded1 ? "Господдержка и вычет" : "Господдержка", "Так каждый год, пока идёт господдержка"]);
    var sn = phone ? 1 : 3, sw = (W - GAP * (sn - 1)) / sn;
    function stepText(s, x, yy, w) {
      var pad = 20, iw = w - 2 * pad, b = yy + pad;
      b = T(s[0], x + pad, b, { size: 10.5, color: C.blue }) + 8;
      b = T(s[1], x + pad, b, { size: phone ? 20 : 22, bold: true, color: C.dblue }) + 10;
      b = T(s[2], x + pad, b, { size: 12, bold: true, maxW: iw, lh: 1.25 }) + 6;
      return T(s[3], x + pad, b, { size: 10, color: C.gray1, maxW: iw, lh: 1.4 }) + pad;
    }
    function stepCard(s, x, yy, w, hFix) {
      var h = Math.max(hFix || 0, measure(function (a, b, c) { return stepText(s, a, b, c); }, w));
      rr(x, yy, w, h, 20, C.f1); stepText(s, x, yy, w); return yy + h;
    }
    for (var r0 = 0; r0 < steps.length; r0 += sn) {
      var row = steps.slice(r0, r0 + sn), rh = Math.max.apply(null, row.map(function (s) { return measure(function (x, yy, w) { return stepCard(s, x, yy, w); }, sw); }));
      place(function (x, yy, w) { row.forEach(function (s, i) { stepCard(s, x + i * (sw + GAP), yy, sw, rh); }); return yy + rh; }, W);
    }

    /* ======================= 5. ЧТО ЕСЛИ: другие взносы и доходность ======================= */
    page(C.f1, "Что если", "Другие суммы и честный диапазон", "Сколько будет на счёте " + (D.now15 ? "через 15 лет" : "к выплатам в " + D.payYear + " году") + " при другом взносе и другой доходности");
    var HW = phone ? W : (W - 24) / 2, X2 = phone ? G.m : G.m + HW + 24, yTop = y;
    var Sc = D.scen, scn = Sc.length, scw = (HW - 10 * (scn - 1)) / scn;
    function scenBlock(x, yy, w) {
      yy = T("Если изменить взнос", x, yy, { size: 15, bold: true }) + 12;
      var h = phone ? 104 : 118;
      Sc.forEach(function (s, i) {
        var sx = x + i * (scw + 10);
        rr(sx, yy, scw, h, 16, C.f2); if (s.me) rrS(sx + 0.75, yy + 0.75, scw - 1.5, h - 1.5, 16, C.blue, 1.5);
        T(s.me ? "Ваш план" : "Взнос", sx + scw / 2, yy + 14, { size: 9, color: s.me ? C.blue : C.gray1, align: "center" });
        T(rub(s.m), sx + scw / 2, yy + 28, { size: phone ? 10 : 11, bold: true, align: "center" });
        var v = D.shortRub(s.v) + NB + "₽", vs = phone ? 13 : 16; while (tw(v, vs, true) > scw - 10 && vs > 9) vs -= 0.5;
        T(v, sx + scw / 2, yy + (phone ? 52 : 56), { size: vs, bold: true, color: C.dblue, align: "center" });
        T(s.gTxt, sx + scw / 2, yy + (phone ? 74 : 82), { size: 8.5, color: C.gray1, align: "center", maxW: scw - 10, lh: 1.25 });
      });
      return yy + h;
    }
    function plusBlock(x, yy, w) {
      var pk = "+1 000 ₽", pkw = tw(pk, 20, true), tx = x + 20 + pkw + 16, tw3 = w - (tx - x) - 20;
      var runs = [["Если добавить 1 000 ₽ в месяц, на счёте будет на ", 0], [rub(D.plus.add), 1], [" больше", 0]].concat(D.plus.sooner ? [[", а " + (D.mil ? "миллион" : "цель") + " наберётся ", 0], [D.plus.sooner, 1]] : []);
      var th = RTH(runs, { size: 10.5, maxW: tw3, lh: 1.4 }), h = Math.max(64, th + 32);
      rr(x, yy, w, h, 16, C.f2);
      T(pk, x + 20, yy + h / 2 - 12, { size: 20, bold: true, color: C.blue });
      RT(runs, tx, yy + (h - th) / 2, { size: 10.5, maxW: tw3, lh: 1.4, color: C.gray1, bcolor: C.dark });
      return yy + h;
    }
    function yieldBlock(x, yy, w) {
      yy = T("Если доходность будет ниже", x, yy, { size: 15, bold: true }) + 4;
      yy = T("Доход от фонда не гарантирован. Так меняется результат при взносе " + rub(D.monthly), x, yy, { size: 10, color: C.gray1, maxW: w }) + 12;
      var rows = D.yields.map(function (q, i) { return [String(q.r * 100).replace(".", ",") + " % годовых", i === 0 ? "как в плане" : "", q.v, [C.blue, C.blue3, C.lblue][i]]; })
        .concat([["Без дохода фонда", "", D.noInc, C.gray2]]);
      var h = 20 + rows.length * 40; rr(x, yy, w, h, 16, C.f2);
      var lw = phone ? 92 : 110, vw = phone ? 82 : 96, bx = x + 20 + lw, bw0 = w - 40 - lw - vw - 8, mx = D.yields[0].v || 1, ry = yy + 10;
      rows.forEach(function (r) {
        T(r[0], x + 20, ry + (r[1] ? 6 : 12), { size: 10, bold: true }); if (r[1]) T(r[1], x + 20, ry + 20, { size: 8.5, color: C.gray1 });
        rr(bx, ry + 11, bw0, 14, 7, C.f1); rr(bx, ry + 11, Math.max(10, r[2] / mx * bw0), 14, 7, r[3]);
        T(rub(r[2]), x + w - 20, ry + 11, { size: 10.5, bold: true, align: "right" });
        ry += 40;
      });
      return yy + h;
    }
    place(scenBlock, HW); place(plusBlock, HW);
    if (!phone) y = yTop;
    place(yieldBlock, HW, X2);
    if (D.kAlt) place(function (x, yy, w) { return T("Господдержка зависит от дохода. При доходе до 80 тыс. ₽ в месяц было бы около " + D.shortRub(D.kAlt) + NB + "₽", x, yy, { size: 10, color: C.gray1, maxW: w, lh: 1.4 }); }, HW, X2);

    /* ======================= 6. ВЫПЛАТЫ И ЗАЩИТА ======================= */
    page(C.f2, D.now15 ? "Выплаты" : "Когда станут доступны выплаты", "Как получать деньги", "Форму выплаты выберете сами. Цифры для суммы " + rub(V));
    yTop = y;
    function payBlock(x, yy, w) {
      var h1 = 104; img(heroImg(w, h1, 20), x, yy, w, h1);
      T("Ежемесячно 10 лет", x + 20, yy + 18, { size: 10, color: C.w70 });
      var pv = "около " + rub(D.pay10) + " в месяц", vs = phone ? 20 : 24; while (tw(pv, vs, true) > w - 40 && vs > 13) vs -= 0.5;
      T(pv, x + 20, yy + 36, { size: vs, bold: true, color: C.f2 });
      T("Срок выбираете сами, от 5 лет. Остаток наследуется", x + 20, yy + h1 - 28, { size: 9.5, color: C.w70, maxW: w - 40 });
      yy += h1 + 10;
      var cw2 = (w - 10) / 2, h2 = phone ? 96 : 84;
      [["Ежемесячно 5 лет", "около " + rub(D.pay5), "в месяц, самый короткий срок"], ["Пожизненно", "каждый месяц", "размер рассчитает фонд при назначении"]].forEach(function (c, i) {
        var px = x + i * (cw2 + 10); rr(px, yy, cw2, h2, 16, C.f1);
        T(c[0], px + 16, yy + 14, { size: 9.5, color: C.gray1, maxW: cw2 - 32 });
        var b = T(c[1], px + 16, yy + 30, { size: phone ? 13 : 15, bold: true, color: C.dblue, maxW: cw2 - 32, lh: 1.15 });
        T(c[2], px + 16, b + 4, { size: 9, color: C.gray1, maxW: cw2 - 32, lh: 1.3 });
      });
      yy += h2 + 10;
      return T("Суммы без учёта дохода, который фонд продолжит начислять в период выплат", x, yy, { size: 9, color: C.gray1, maxW: w });
    }
    function protBlock(x, yy, w) {
      var items = [["Застрахованы до 2,8 млн ₽", "Агентство по страхованию вкладов"], ["Наследуются", "Средства на счёте, включая господдержку и доход, получат наследники"], ["Доступны в особых случаях", "При дорогостоящем лечении или потере кормильца до 100 % средств без потери условий"], ["Можно расторгнуть", "Выплачивается выкупная сумма, она может быть меньше внесённого"]];
      var pad = 20, ib = phone ? 64 : 80, hh = pad + ib + 12, iw = w - 2 * pad;
      items.forEach(function (it) { hh += TH(it[0], { size: 11.5, bold: true, maxW: iw - 18 }) + 2 + TH(it[1], { size: 9.5, maxW: iw - 18, lh: 1.35 }) + 14; });
      hh += pad - 14;
      rr(x, yy, w, hh, 20, C.f1);
      fit("safe", x + pad - 6, yy + pad - 6, ib);
      T("Что защищает ваши деньги", x + pad + ib + 8, yy + pad + ib / 2 - 9, { size: 14, bold: true, maxW: w - 2 * pad - ib - 8 });
      var b = yy + pad + ib + 12;
      items.forEach(function (it) {
        dot(x + pad + 4, b + 7, 4, C.blue);
        var t = T(it[0], x + pad + 18, b, { size: 11.5, bold: true, maxW: iw - 18 });
        b = T(it[1], x + pad + 18, t + 2, { size: 9.5, color: C.gray1, maxW: iw - 18, lh: 1.35 }) + 14;
      });
      return yy + hh;
    }
    place(payBlock, HW);
    if (!phone) y = yTop;
    place(protBlock, HW, X2);

    /* ======================= 7. НАЧНИТЕ В ЭТОМ ГОДУ ======================= */
    page(C.f1, "Следующий шаг", "Начните в этом году");
    yTop = y;
    function goBlock(x, yy, w) {
      var h = 112; img(heroImg(w, h, 20), x, yy, w, h);
      var ib = 88; fit("hourglass", x + w - ib - 12, yy + (h - ib) / 2, ib);
      var tw4 = w - 40 - ib - 8;
      var gb = T(D.daysLeft > 0 ? "До конца года " + D.daysLeft + NB + plural(D.daysLeft, ["день", "дня", "дней"]) : "До 31 декабря", x + 20, yy + 18, { size: 10, color: C.lblue }) + 4;
      gb = T("Успейте до 31" + NB + "декабря", x + 20, gb, { size: phone ? 16 : 18, bold: true, color: C.f2, maxW: tw4, lh: 1.15 }) + 6;
      T("Взносы от 2 000 ₽ в " + Y0 + " году дают право на господдержку и вычет за этот год", x + 20, gb, { size: 9.5, color: C.w70, maxW: tw4, lh: 1.35 });
      yy += h + 12;
      var bh = 52; rr(x, yy, w, bh, 12, C.blue);
      T("Оформить через Госуслуги", x + w / 2, yy + bh / 2 - 8, { size: 14, bold: true, color: C.f2, align: "center" });
      link(x, yy, w, bh, D.contractUrl);
      yy += bh + 16;
      ["Войдите через Госуслуги, часть данных подставится сама", "Проверьте анкету и поставьте согласие", "Сделайте первый взнос, и господдержка заработает"].forEach(function (s, i) {
        dot(x + 12, yy + 12, 12, C.f2); T(String(i + 1), x + 12, yy + 6, { size: 10, bold: true, color: C.blue, align: "center" });
        yy = Math.max(yy + 24, T(s, x + 34, yy + 5, { size: 11, color: C.dark, maxW: w - 34 })) + 8;
      });
      return yy;
    }
    function qrBlock(x, yy, w) {
      var pad = 20, qs = phone ? 96 : 120, h = pad * 2 + qs; rr(x, yy, w, h, 20, C.f2);
      if (window.__PDF_QR && DRAW) {
        var rows = window.__PDF_QR.rows, n = rows.length, cell = qs / n; fill(C.dark);
        rows.forEach(function (r, ry) { for (var rx = 0; rx < n; rx++) if (r.charAt(rx) === "1") doc.rect(x + pad + rx * cell, yy + pad + ry * cell, cell + 0.15, cell + 0.15, "F"); });
        link(x + pad, yy + pad, qs, qs, window.__PDF_QR.url);
      }
      var tx = x + pad + qs + 20, tw5 = w - (tx - x) - pad;
      var b = T("Расчёт на телефоне", tx, yy + pad, { size: 14, bold: true, maxW: tw5 });
      b = T("Наведите камеру на код: откроется страница с калькулятором", tx, b + 6, { size: 10, color: C.gray1, maxW: tw5, lh: 1.4 });
      b = T("8 800 700-75-50", tx, b + 12, { size: 14, bold: true, color: C.dblue });
      T("звонок по России бесплатный", tx, b + 2, { size: 9.5, color: C.gray1 });
      return yy + h;
    }
    place(goBlock, HW);
    if (!phone) y = yTop;
    place(qrBlock, HW, X2);
    place(function (x, yy, w) { return T(disclaimer, x, yy, { size: 7.5, color: C.gray1, maxW: w, lh: 1.4 }); }, HW, X2);

    TOTAL = pageNo;
    drawFooters();
    return doc.output("blob");
  }
})();
