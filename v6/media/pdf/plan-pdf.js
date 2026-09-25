/* =====================================================================
   План ПДС в PDF. Два макета из одних данных:
   · phone — узкие высокие страницы под экран телефона, крупный текст,
     каждый блок на своей странице, ничего не нужно увеличивать;
   · a4 — вертикальный A4 для компьютера и печати.
   Цвета, шрифт и карточки повторяют страницу. Кнопка оформления — живая ссылка,
   QR ведёт на страницу расчёта.
   ===================================================================== */
(function () {
  "use strict";
  var C = {
    ink: "#1D1D1F", ink2: "#424245", muted: "#6E6E73", faint: "#9A9AA0", line: "#E3E3E8",
    bg: "#FFFFFF", bg2: "#F5F5F7", accent: "#0064FF", accentSoft: "#EAF1FF", warm: "#FF7D4A", warmSoft: "#FFF1EA",
    warm2: "#FF9F78", sky: "#1E8FFA", green: "#14A570", greenSoft: "#E8F6EF"
  };
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }

  window.buildPlanPdf = function (D, mode) {
    var jsPDF = window.jspdf.jsPDF;
    var phone = mode === "phone";
    var G = phone ? { w: 360, h: 780, m: 24 } : { w: 595.28, h: 841.89, m: 48 };
    var F = phone
      ? { cap: 12.5, small: 13, body: 15.5, lead: 17, h2: 22, h1: 30, big: 38, huge: 44 }
      : { cap: 9, small: 10, body: 12, lead: 13.5, h2: 17, h1: 28, big: 36, huge: 40 };
    var doc = new jsPDF({ unit: "pt", format: [G.w, G.h], orientation: "portrait", compress: true });
    doc.addFileToVFS("Inter-500.ttf", window.__PDF_FONT_500); doc.addFont("Inter-500.ttf", "Inter", "normal");
    doc.addFileToVFS("Inter-700.ttf", window.__PDF_FONT_700); doc.addFont("Inter-700.ttf", "Inter", "bold");
    doc.setProperties({ title: "Мой план ПДС · Цель миллион", subject: "Предварительный расчёт программы долгосрочных сбережений", author: "АО «НПФ ГАЗФОНД пенсионные накопления»", creator: "ГАЗФОНД ПН" });
    var W = G.w - G.m * 2, pageNo = 0, pages = phone ? 4 : 3;

    function fill(c) { var a = hex(c); doc.setFillColor(a[0], a[1], a[2]); }
    function stroke(c) { var a = hex(c); doc.setDrawColor(a[0], a[1], a[2]); }
    function color(c) { var a = hex(c); doc.setTextColor(a[0], a[1], a[2]); }
    function font(size, bold) { doc.setFont("Inter", bold ? "bold" : "normal"); doc.setFontSize(size); }
    /* текстовый блок с переносами; возвращает y под блоком */
    function T(str, x, y, o) {
      o = o || {}; font(o.size || F.body, o.bold); color(o.color || C.ink);
      var lh = (o.size || F.body) * (o.lh || 1.32), lines = o.maxW ? doc.splitTextToSize(String(str), o.maxW) : [String(str)];
      lines.forEach(function (ln, i) { doc.text(ln, x, y + (o.size || F.body) * 0.8 + i * lh, { align: o.align || "left", charSpace: o.cs || 0 }); });
      return y + lines.length * lh;
    }
    function card(x, y, w, h, c, r) { fill(c || C.bg2); doc.roundedRect(x, y, w, h, r || (phone ? 16 : 14), r || (phone ? 16 : 14), "F"); }
    function header() {
      pageNo++;
      fill(C.bg); doc.rect(0, 0, G.w, G.h, "F");
      var lh = phone ? 22 : 24;
      if (D.img.logo) doc.addImage(D.img.logo, "PNG", G.m, G.m - 6, lh * D.img.logoRatio, lh);
      T(D.dateTxt, G.w - G.m, G.m - 2, { size: F.cap, color: C.muted, align: "right" });
      stroke(C.line); doc.setLineWidth(0.6); doc.line(G.m, G.m + lh + 8, G.w - G.m, G.m + lh + 8);
      return G.m + lh + 24;
    }
    function footer() {
      var y = G.h - G.m + (phone ? 6 : 14);
      stroke(C.line); doc.setLineWidth(0.6); doc.line(G.m, y - 10, G.w - G.m, y - 10);
      T(phone ? "НПФ ГАЗФОНД ПН · лицензия Банка России № 430" : "АО «НПФ ГАЗФОНД пенсионные накопления» · лицензия Банка России № 430", G.m, y - 4, { size: phone ? 10 : F.cap, color: C.faint });
      T(pageNo + " / " + pages, G.w - G.m, y - 4, { size: phone ? 10 : F.cap, color: C.faint, align: "right" });
    }
    function bar4(x, y, w, h) {
      var t = D.hp.value || 1, parts = [[D.hp.contrib, C.accent], [D.hp.cofin, C.warm], [D.hp.ded, C.warm2], [D.hp.inc, C.sky]], cx = x;
      fill(C.line); doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
      parts.forEach(function (p, i) { var pw = Math.max(0, p[0] / t * w - (i < 3 ? 2 : 0)); if (pw <= 0) return; fill(p[1]); doc.rect(cx, y, pw, h, "F"); cx += pw + 2; });
    }
    function legend(x, y, maxW, size) {
      var items = [["ваши взносы", C.accent], ["господдержка", C.warm], ["вычет", C.warm2], ["доход фонда", C.sky]], cx = x, cy = y;
      font(size, false);
      items.forEach(function (it) {
        var w = doc.getTextWidth(it[0]) + size * 1.6;
        if (cx + w > x + maxW) { cx = x; cy += size * 1.6; }
        fill(it[1]); doc.circle(cx + size * 0.35, cy + size * 0.45, size * 0.33, "F");
        color(C.muted); doc.text(it[0], cx + size * 0.95, cy + size * 0.8);
        cx += w;
      });
      return cy + size * 1.6;
    }
    function button(x, y, w, h, label) {
      fill(C.accent); doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
      font(phone ? 17 : 14, true); color("#FFFFFF");
      doc.text(label, x + w / 2, y + h / 2 + (phone ? 6 : 5), { align: "center" });
      doc.link(x, y, w, h, { url: D.contractUrl });
    }
    function qr(x, y, size) {
      var rows = window.__PDF_QR.rows, n = rows.length, cell = size / n;
      fill(C.bg); doc.rect(x - cell * 2, y - cell * 2, size + cell * 4, size + cell * 4, "F");
      fill(C.ink);
      rows.forEach(function (r, ry) { for (var rx = 0; rx < n; rx++) if (r.charAt(rx) === "1") doc.rect(x + rx * cell, y + ry * cell, cell + 0.15, cell + 0.15, "F"); });
      doc.link(x, y, size, size, { url: window.__PDF_QR.url });
    }
    /* график: счёт ПДС, копилка без процентов, цель, момент выплат */
    function chart(x, y, w, h, fs) {
      var S = D.series, n = S.length, maxV = 0;
      S.forEach(function (q) { maxV = Math.max(maxV, q.v, q.b); }); maxV = Math.max(maxV, D.target * 1.12);
      var step = maxV > 6e6 ? 2e6 : maxV > 3e6 ? 1e6 : maxV > 1.2e6 ? 5e5 : 2.5e5;
      var pl = fs * 3.6, pb = fs * 2.2, pt = fs * 1.8;
      var X = function (i) { return x + pl + i / (n - 1) * (w - pl); }, Y = function (v) { return y + pt + (1 - v / maxV) * (h - pt - pb); };
      doc.setLineWidth(0.6); stroke(C.line);
      for (var v = step; v <= maxV; v += step) { doc.line(x + pl, Y(v), x + w, Y(v)); T(D.shortRub(v), x + pl - 6, Y(v) - fs * 0.62, { size: fs, color: C.muted, align: "right" }); }
      stroke("#C7C7CC"); doc.line(x + pl, Y(0), x + w, Y(0));
      var perYear = (w - pl) / (n / 12), every = [1, 2, 3, 4, 5, 10].filter(function (k) { return perYear * k >= fs * 3.4; })[0] || 10;
      for (var i = 0; i < n; i++) { var cal = D.startMonth + i; if (cal % 12 === 0 && (cal / 12) % every === 0 && X(i) > x + pl + fs && X(i) < x + w - fs) T(String(D.startYear + cal / 12), X(i), Y(0) + fs * 0.4, { size: fs, color: C.muted, align: "center" }); }
      /* цель */
      stroke(C.warm); doc.setLineWidth(1); doc.setLineDashPattern([4, 4], 0); doc.line(x + pl, Y(D.target), x + w, Y(D.target)); doc.setLineDashPattern([], 0);
      T("Цель: " + D.shortRub(D.target), x + w - 4, Y(D.target) + fs * 0.35, { size: fs, bold: true, color: C.warm, align: "right" });
      /* выплаты */
      if (D.pm < n) { stroke(C.green); doc.setLineDashPattern([3, 3], 0); doc.line(X(D.pm), y + pt, X(D.pm), Y(0)); doc.setLineDashPattern([], 0); T("выплаты с " + D.payYear, X(D.pm), y, { size: fs, bold: true, color: C.green, align: X(D.pm) > x + w * 0.75 ? "right" : "center" }); }
      /* копилка */
      stroke(C.faint); doc.setLineWidth(1.2); doc.setLineDashPattern([1.5, 3], 0);
      for (var k = 1; k < n; k += 1) doc.line(X(k - 1), Y(S[k - 1].b), X(k), Y(S[k].b));
      doc.setLineDashPattern([], 0);
      /* счёт ПДС */
      stroke(C.accent); doc.setLineWidth(2.2); doc.setLineJoin && doc.setLineJoin("round");
      var segs = [], px = X(0), py = Y(S[0].v);
      for (var q = 1; q < n; q++) { var nx = X(q), ny = Y(S[q].v); segs.push([nx - px, ny - py]); px = nx; py = ny; }
      doc.lines(segs, X(0), Y(S[0].v), [1, 1], "S", false);
      if (D.g && D.g <= n) { fill(C.accent); doc.circle(X(D.g - 1), Y(D.target), 3.6, "F"); T(D.gShort, X(D.g - 1), Y(D.target) - fs * 1.9, { size: fs, bold: true, color: C.accent, align: X(D.g - 1) > x + w * 0.8 ? "right" : "center" }); }
      return y + h;
    }
    function legendChart(x, y, fs) {
      var items = [["Счёт ПДС", C.accent, false], ["Копилка без процентов", C.faint, true], ["Цель", C.warm, true], ["Выплаты доступны", C.green, true]], cx = x, cy = y;
      font(fs, false);
      items.forEach(function (it) {
        var w = doc.getTextWidth(it[0]) + fs * 3;
        if (cx + w > x + W) { cx = x; cy += fs * 1.7; }
        stroke(it[1]); doc.setLineWidth(it[2] ? 1.2 : 2.2); if (it[2]) doc.setLineDashPattern([2, 2], 0);
        doc.line(cx, cy + fs * 0.45, cx + fs * 1.3, cy + fs * 0.45); doc.setLineDashPattern([], 0);
        color(C.ink2); doc.text(it[0], cx + fs * 1.7, cy + fs * 0.8); cx += w;
      });
      return cy + fs * 1.7;
    }
    function srcCard(x, y, w, h, s, big) {
      card(x, y, w, h, C.bg2);
      var pad = phone ? 16 : 14, isz = phone ? 64 : 52;
      if (s.img) doc.addImage(s.img, "PNG", x + pad, y + pad, isz, isz);
      var tx = x + pad + isz + (phone ? 14 : 12), tw = w - (tx - x) - pad;
      fill(s.c); doc.circle(tx + 3.5, y + pad + F.small * 0.5, 3.5, "F");
      T(s.k, tx + 11, y + pad, { size: F.small, bold: true, color: C.muted });
      var yy = T(s.v, tx, y + pad + F.small * 1.5, { size: big, bold: true, color: C.ink });
      T(s.p, tx, yy + 4, { size: F.small, color: C.ink2, maxW: tw, lh: 1.35 });
    }
    function nextSteps(x, y, w) {
      var steps = ["Нажмите «Оформить через Госуслуги» и войдите, часть данных подставится автоматически", "Проверьте анкету и поставьте согласие", "Сделайте первый взнос. Дальнейшие взносы удобно делать автоплатежом"];
      var sz = F.body, cy = y;
      steps.forEach(function (s, i) {
        fill(C.bg2); doc.circle(x + sz * 0.8, cy + sz * 0.8, sz * 0.8, "F");
        T(String(i + 1), x + sz * 0.8, cy + sz * 0.08, { size: sz * 0.9, bold: true, color: C.ink, align: "center" });
        cy = T(s, x + sz * 2.3, cy, { size: sz, color: C.ink2, maxW: w - sz * 2.3 }) + sz * 0.7;
      });
      return cy;
    }
    var disclaimer = "Расчёт предварительный и не является гарантией дохода. Доходность 10 % годовых взята для примера, доход фонда не гарантирован. Господдержка до 36 000 ₽ в год в первые 10 лет при взносах от 2 000 ₽ в год, размер зависит от официального дохода. Налоговый вычет от 13 до 22 % от взносов (не более чем с 400 000 ₽ в год) возвращает ФНС по вашему заявлению, в расчёте взято 13 %. Выплаты по общему правилу доступны через 15 лет действия договора либо с 55 лет женщинам и 60 лет мужчинам. При досрочном расторжении выплачивается выкупная сумма, она может быть меньше внесённого. Средства застрахованы АСВ на сумму до 2,8 млн ₽.";

    var sources = [
      { k: "Ваши взносы", v: D.rub(D.hp.contrib), p: "Любая сумма и периодичность, взнос можно менять и пропускать.", c: C.accent, img: D.img.src[0] },
      { k: "Господдержка", v: "+ " + D.rub(D.hp.cofin), p: "До 36 000 ₽ в год в первые 10 лет, размер зависит от дохода.", c: C.warm, img: D.img.src[1] },
      { k: "Налоговый вычет", v: "+ " + D.rub(D.hp.ded), p: "От 13 до 22 % от взносов по вашему заявлению в ФНС. В расчёте 13 %.", c: C.warm2, img: D.img.src[2] },
      { k: "Доход фонда, прогноз", v: "+ " + D.rub(D.hp.inc), p: "Фонд инвестирует средства и распределяет доход по итогам года.", c: C.sky, img: D.img.src[3] }
    ];

    /* ---------- обложка: главный результат ---------- */
    function cover(y, withImage) {
      T(phone ? "ЦЕЛЬ МИЛЛИОН · ПДС" : "ЦЕЛЬ МИЛЛИОН · ПРОГРАММА ДОЛГОСРОЧНЫХ СБЕРЕЖЕНИЙ", G.m, y, { size: F.cap, bold: true, color: C.warm, cs: 0.3 });
      y = T("Ваш план накоплений", G.m, y + F.cap * 1.8, { size: F.h1, bold: true, maxW: W, lh: 1.1 }) + (phone ? 14 : 12);
      y = T("Взнос " + D.rub(D.monthly) + " в месяц" + (D.first ? ", стартовый взнос " + D.rub(D.first) : ""), G.m, y, { size: F.lead, color: C.ink2, maxW: W }) + (phone ? 18 : 16);
      var ch = phone ? 312 : 250, imgW = withImage ? (phone ? 0 : 130) : 0;
      card(G.m, y, W, ch, C.bg2);
      var pad = phone ? 20 : 22, tw = W - pad * 2 - imgW;
      var yy = T(D.whenTxt + ", будет около", G.m + pad, y + pad, { size: F.small, color: C.muted, maxW: tw });
      yy = T(D.rub(D.hp.value), G.m + pad, yy + 4, { size: F.huge * (phone ? 0.9 : 1), bold: true, color: C.accent, lh: 1.05 });
      yy = T("из них " + D.rub(D.hp.add) + " добавят государство, вычет и доход фонда", G.m + pad, yy + 6, { size: F.body, color: C.ink2, maxW: tw });
      bar4(G.m + pad, yy + 14, tw, phone ? 8 : 7);
      yy = legend(G.m + pad, yy + 30, tw, F.cap) + 6;
      card(G.m + pad, yy, W - pad * 2, phone ? 44 : 34, "#FFFFFF", 10);
      T(D.goalTxt + " на счёте", G.m + pad + 14, yy + (phone ? 13 : 10), { size: F.small, color: C.muted });
      T(D.gYears, G.m + W - pad - 14, yy + (phone ? 13 : 10), { size: F.small, bold: true, color: C.ink, align: "right" });
      if (imgW && D.img.column) { var ih = Math.min(ch - pad * 2 - 44, imgW * 640 / 360 * 0.8), iw = ih * 360 / 640; doc.addImage(D.img.column, "PNG", G.m + W - pad - iw, y + pad - 4, iw, ih); }
      y += ch + (phone ? 16 : 14);
      y = T(D.paramsTxt, G.m, y, { size: F.small, color: C.muted, maxW: W });
      return y;
    }

    if (phone) {
      /* 1. результат */
      var y = header(); y = cover(y, false);
      if (D.img.column) { var avail = G.h - G.m - 24 - (y + 10), ih = Math.min(200, avail), iw = ih * 360 / 640; if (ih > 60) doc.addImage(D.img.column, "PNG", G.w / 2 - iw / 2, y + 6, iw, ih); }
      footer();
      /* 2. источники */
      doc.addPage([G.w, G.h]); y = header();
      y = T("Из чего складывается сумма", G.m, y, { size: F.h2, bold: true, maxW: W }) + 6;
      y = T(D.yearsCap + " на счёте будет около " + D.rub(D.hp.value) + ":", G.m, y, { size: F.small, color: C.muted, maxW: W }) + 14;
      sources.forEach(function (s) { srcCard(G.m, y, W, 128, s, 24); y += 128 + 12; });
      footer();
      /* 3. график */
      doc.addPage([G.w, G.h]); y = header();
      y = T("Как растут накопления", G.m, y, { size: F.h2, bold: true, maxW: W }) + 6;
      y = T("Счёт ПДС и копилка без процентов при тех же взносах", G.m, y, { size: F.small, color: C.muted, maxW: W }) + 16;
      y = chart(G.m, y, W, 330, 12.5) + 14;
      y = legendChart(G.m, y, 12.5) + 16;
      card(G.m, y, W, 64, C.greenSoft); T("Выплаты станут доступны", G.m + 16, y + 12, { size: F.small, color: C.muted }); T(D.payTxt, G.m + 16, y + 32, { size: F.lead, bold: true, color: C.ink });
      y += 76;
      card(G.m, y, W, 64, C.accentSoft); T(D.goalTxt + " на счёте", G.m + 16, y + 12, { size: F.small, color: C.muted }); T(D.gYears, G.m + 16, y + 32, { size: F.lead, bold: true, color: C.ink });
      footer();
      /* 4. следующий шаг */
      doc.addPage([G.w, G.h]); y = header();
      card(G.m, y, W, 104, C.warmSoft);
      T("Успейте до 31 декабря", G.m + 16, y + 14, { size: F.lead, bold: true, color: C.ink });
      T("Взносы от 2 000 ₽ в " + D.year + " году дают право на господдержку и налоговый вычет за этот год. Осталось " + D.daysLeft + ".", G.m + 16, y + 38, { size: F.small, color: C.ink2, maxW: W - 32 });
      y += 120;
      button(G.m, y, W, 56, "Оформить через Госуслуги"); y += 72;
      y = nextSteps(G.m, y, W) + 8;
      var qs = 104; qr(G.m, y, qs);
      T("Наведите камеру телефона, чтобы открыть расчёт на сайте", G.m + qs + 14, y + 6, { size: F.small, color: C.ink2, maxW: W - qs - 14 });
      T("8 800 700 75 50", G.m + qs + 14, y + 62, { size: F.lead, bold: true, color: C.ink }); T("звонок по России бесплатный", G.m + qs + 14, y + 84, { size: F.cap, color: C.muted });
      y += qs + 16;
      T(disclaimer, G.m, y, { size: 8.6, color: C.faint, maxW: W, lh: 1.3 });
      footer();
    } else {
      /* 1. результат и источники */
      var y2 = header(); y2 = cover(y2, true) + 22;
      y2 = T("Из чего складывается сумма", G.m, y2, { size: F.h2, bold: true }) + 12;
      var cw = (W - 14) / 2, chh = 112;
      sources.forEach(function (s, i) { srcCard(G.m + (i % 2) * (cw + 14), y2 + Math.floor(i / 2) * (chh + 14), cw, chh, s, 18); });
      footer();
      /* 2. график и сроки */
      doc.addPage([G.w, G.h]); y2 = header();
      y2 = T("Как растут накопления", G.m, y2, { size: F.h2, bold: true }) + 4;
      y2 = T("Счёт ПДС и копилка без процентов при тех же взносах", G.m, y2, { size: F.small, color: C.muted }) + 14;
      y2 = chart(G.m, y2, W, 320, 10) + 12;
      y2 = legendChart(G.m, y2, 10) + 20;
      var hw = (W - 14) / 2;
      card(G.m, y2, hw, 70, C.greenSoft); T("Выплаты станут доступны", G.m + 16, y2 + 14, { size: F.small, color: C.muted }); T(D.payTxt, G.m + 16, y2 + 34, { size: F.lead, bold: true, color: C.ink, maxW: hw - 32 });
      card(G.m + hw + 14, y2, hw, 70, C.accentSoft); T(D.goalTxt + " на счёте", G.m + hw + 30, y2 + 14, { size: F.small, color: C.muted }); T(D.gYears, G.m + hw + 30, y2 + 34, { size: F.lead, bold: true, color: C.ink });
      y2 += 92;
      y2 = T("Коротко об условиях", G.m, y2, { size: F.h2, bold: true }) + 10;
      ["Взносы можно менять и пропускать, обязательных платежей нет.", "При дорогостоящем лечении или потере кормильца можно получить до 100 % средств без потери господдержки и дохода.", "Средства застрахованы АСВ на сумму до 2,8 млн ₽ и наследуются.", "При досрочном расторжении выплачивается выкупная сумма, она может быть меньше внесённого."].forEach(function (s) {
        fill(C.accent); doc.circle(G.m + 4, y2 + F.body * 0.55, 2.4, "F");
        y2 = T(s, G.m + 16, y2, { size: F.body, color: C.ink2, maxW: W - 16 }) + 8;
      });
      footer();
      /* 3. следующий шаг */
      doc.addPage([G.w, G.h]); y2 = header();
      y2 = T("Следующий шаг", G.m, y2, { size: F.h1, bold: true }) + 16;
      card(G.m, y2, W, 74, C.warmSoft);
      T("Успейте до 31 декабря", G.m + 20, y2 + 16, { size: F.lead, bold: true });
      T("Взносы от 2 000 ₽ в " + D.year + " году дают право на господдержку и налоговый вычет за этот год. Осталось " + D.daysLeft + ".", G.m + 20, y2 + 38, { size: F.body, color: C.ink2, maxW: W - 40 });
      y2 += 96;
      y2 = nextSteps(G.m, y2, W) + 12;
      button(G.m, y2, W, 52, "Оформить через Госуслуги"); y2 += 76;
      card(G.m, y2, W, 156, C.bg2);
      qr(G.m + 22, y2 + 22, 112);
      T("Откройте расчёт на телефоне", G.m + 160, y2 + 26, { size: F.lead, bold: true });
      T("Наведите камеру на код: откроется страница с калькулятором и кнопкой оформления.", G.m + 160, y2 + 50, { size: F.body, color: C.ink2, maxW: W - 190 });
      T("8 800 700 75 50 · звонок по России бесплатный", G.m + 160, y2 + 104, { size: F.body, bold: true, color: C.ink });
      y2 += 180;
      T(disclaimer, G.m, y2, { size: 8.4, color: C.faint, maxW: W, lh: 1.35 });
      footer();
    }
    return doc.output("blob");
  };
})();
