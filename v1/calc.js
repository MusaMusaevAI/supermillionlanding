/* ============================================================
   «Цель — миллион» — движок расчёта (ПДС).
   Методология (подтверждена методологом, август 2026):
   - ИД: 10% годовых. Начисляется на сумму взноса с момента зачисления
     и до конца календарного года. Внутри года — без капитализации
     (простое начисление); капитализация — один раз, в конце года.
     Перенесённый остаток работает весь следующий год целиком.
   - Взносы — в начале месяца (первый взнос — в месяц старта).
   - Софинансирование: min(36 000 ₽; k × личные взносы за календарный год),
     k = 1 / 0,5 / 0,25 по среднемесячному доходу; зачисляется в июле
     следующего года; первые 10 календарных лет участия; при личных
     взносах от 2 000 ₽ за год. Итоговый коэффициент определяет ФНС.
   - Налоговый вычет — НЕ на счёте ПДС (возвращается клиенту), в цель
     не входит, показывается отдельной строкой. Опция «возвращаю вычет
     в ПДС»: возврат за прошлый год зачисляется на счёт в апреле
     следующего года и считается личным взносом (входит в базу
     софинансирования и следующего вычета). Ставка в расчёте — 13%,
     база — до 400 000 ₽ взносов в год.
   Предварительный расчёт. Доходность не гарантируется.
   ============================================================ */
var CALC = (function () {
  "use strict";

  var RATE = 0.10;          // ИД, годовых
  var CAP_MONTH = 2;        // месяц зачисления годового дохода: 2 = март следующего года
  var TARGET = 1000000;     // цель на счёте ПДС
  var TAX = 0.13;           // ставка НДФЛ в расчёте вычета
  var COFIN_MAX = 36000;    // потолок софинансирования, ₽/год
  var COFIN_YEARS = 10;     // первые 10 календарных лет участия
  var COFIN_MIN = 2000;     // мин. личные взносы за год
  var DED_CAP = 400000;     // база вычета, ₽ взносов в год
  var MAX_MONTHS = 480;

  /**
   * Помесячная симуляция счёта ПДС.
   * @param {object} p
   *   first      — первый (стартовый) взнос, ₽
   *   monthly    — ежемесячный взнос, ₽
   *   k          — коэффициент софинансирования (1 / 0.5 / 0.25)
   *   reinvest   — возвращать налоговый вычет в ПДС
   *   startMonth — календарный месяц старта, 0 = январь … 11 = декабрь
   *   maxMonths  — горизонт симуляции
   * @returns {hist:[{value,contrib,cofin,dedRe}], goalMonths, yearContrib}
   */
  function simulate(p) {
    var first = p.first || 0, monthly = p.monthly || 0, k = p.k;
    var reinvest = !!p.reinvest;
    var startMonth = p.startMonth || 0;
    var maxMonths = p.maxMonths || MAX_MONTHS;

    var balance = 0;   // капитализированный остаток (взносы + софин + зачисленные ИД)
    var accrued = 0;   // ИД, начисляемый в текущем году (фиксируется 31 декабря)
    var pending = 0;   // ИД за прошедший год, ожидающий зачисления в CAP_MONTH
    var contrib = 0, cofin = 0, dedRe = 0;
    // Две базы намеренно разделены:
    //  yearOwn  — только личные взносы клиента. От них считается налоговый вычет,
    //             поэтому его сумма НЕ зависит от того, реинвестируется он или нет
    //             (вычет с ранее возвращённого вычета консервативно не начисляем).
    //  yearPaid — все зачисления клиента, включая возвращённый вычет: это фактически
    //             уплаченные взносы, и именно они формируют базу софинансирования.
    var yearOwn = {}, yearPaid = {};
    var hist = [];
    var goal = null;

    for (var m = 0; m < maxMonths; m++) {
      var cal = startMonth + m;
      var y = Math.floor(cal / 12);  // 0 = год старта
      var mo = cal % 12;             // 0 = январь … 11 = декабрь

      // 1. Взносы — в начале месяца
      var c = (m === 0 ? first : 0) + monthly;
      if (c > 0) {
        balance += c; contrib += c;
        yearOwn[y] = (yearOwn[y] || 0) + c;
        yearPaid[y] = (yearPaid[y] || 0) + c;
      }

      // 2. Реинвест вычета за прошлый год — в апреле (зачисляется как взнос)
      if (reinvest && mo === 3 && y > 0) {
        var base = yearOwn[y - 1] || 0;
        if (base > 0) {
          var d = TAX * Math.min(DED_CAP, base);
          balance += d; dedRe += d;
          yearPaid[y] = (yearPaid[y] || 0) + d;
        }
      }

      // 3. Софинансирование за прошлый год — в июле
      if (mo === 6 && y > 0 && (y - 1) < COFIN_YEARS) {
        var prev = yearPaid[y - 1] || 0;
        if (prev >= COFIN_MIN) {
          var cf = Math.min(COFIN_MAX, k * prev);
          balance += cf; cofin += cf;
        }
      }

      // 4. Зачисление дохода за прошедший год — фонд распределяет его в марте
      if (mo === CAP_MONTH && pending > 0) { balance += pending; pending = 0; }

      // 5. ИД за месяц: простое начисление на остаток
      //    (взнос этого месяца уже в остатке — работает «с момента зачисления»)
      accrued += balance * RATE / 12;

      // 6. Итог года фиксируется 31 декабря и ждёт зачисления в CAP_MONTH
      if (mo === 11) { pending += accrued; accrued = 0; }

      var value = balance + accrued + pending;  // стоимость счёта с учётом начисленного ИД
      hist.push({ value: value, contrib: contrib, cofin: cofin, dedRe: dedRe });
      if (goal === null && value >= TARGET) goal = m + 1;
    }
    return { hist: hist, goalMonths: goal, yearOwn: yearOwn, yearPaid: yearPaid };
  }

  /** Стоимость счёта через months месяцев. */
  function valueAt(p, months) {
    var r = simulate(Object.assign({}, p, { maxMonths: months }));
    return r.hist.length ? r.hist[r.hist.length - 1].value : 0;
  }

  /** Обратная задача: требуемый ежемесячный взнос под срок (бинарный поиск). */
  function requiredMonthly(p, months) {
    var lo = 0, hi = 1000000;
    for (var i = 0; i < 50; i++) {
      var mid = (lo + hi) / 2;
      if (valueAt(Object.assign({}, p, { monthly: mid }), months) >= TARGET) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  /** Требуемый ДОПОЛНИТЕЛЬНЫЙ стартовый взнос под срок при заданном ежемесячном. */
  function requiredExtraFirst(p, months) {
    if (valueAt(p, months) >= TARGET) return 0;
    var lo = 0, hi = 5000000;
    if (valueAt(Object.assign({}, p, { first: (p.first || 0) + hi }), months) < TARGET) return null;
    for (var i = 0; i < 50; i++) {
      var mid = (lo + hi) / 2;
      if (valueAt(Object.assign({}, p, { first: (p.first || 0) + mid }), months) >= TARGET) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  /** Месяц (1-based) достижения произвольной суммы, null если не достигается. */
  function monthsToAmount(p, amount) {
    var r = simulate(p);
    for (var i = 0; i < r.hist.length; i++) if (r.hist[i].value >= amount) return i + 1;
    return null;
  }

  /**
   * Сумма налоговых вычетов, заработанных ЛИЧНЫМИ взносами клиента за период.
   * Считается от yearOwn, поэтому одинакова и для режима «вычет на карту»,
   * и для режима «вычет возвращаю в ПДС» — от способа использования она не зависит.
   */
  function deductionsEarned(p, uptoMonths) {
    var r = simulate(Object.assign({}, p, { maxMonths: uptoMonths || MAX_MONTHS }));
    var sum = 0;
    for (var y in r.yearOwn) sum += TAX * Math.min(DED_CAP, r.yearOwn[y]);
    return sum;
  }

  /**
   * Экранная логика «срок vs взнос» (раздел 3a концепции).
   * wantMonths = null — «посчитайте сами».
   * Возвращает { branch: 'fits'|'raise'|'keep'|'extreme', ... }.
   */
  function plan(p, wantMonths) {
    var sim = simulate(p);
    var tCalc = sim.goalMonths;                       // может быть null (>40 лет)
    var res = { tCalc: tCalc, sim: sim };

    if (wantMonths == null) {
      if (tCalc !== null && tCalc <= 180) { res.branch = "fits"; return res; }
      res.branch = "extreme"; return res;
    }

    if (tCalc !== null && tCalc <= wantMonths + 6) {  // правило 1: план сходится (±6 мес)
      res.branch = "fits"; return res;
    }

    var mReq = requiredMonthly(p, wantMonths);
    res.mReq = mReq;
    res.atWant = valueAt(p, wantMonths);
    var ratio = p.monthly > 0 ? mReq / p.monthly : Infinity;

    if (ratio > 3 || tCalc === null || tCalc > 180) { // правило 4: экстремальный разрыв
      res.branch = "extreme"; return res;
    }
    if (ratio <= 1.5) {                               // правило 2: достижимо повышением взноса
      res.branch = "raise"; return res;
    }
    res.branch = "keep";                              // правило 3: приоритет взноса
    res.extraFirst = requiredExtraFirst(p, wantMonths);
    return res;
  }

  return {
    RATE: RATE, TARGET: TARGET, TAX: TAX,
    COFIN_MAX: COFIN_MAX, COFIN_YEARS: COFIN_YEARS, COFIN_MIN: COFIN_MIN, DED_CAP: DED_CAP,
    simulate: simulate, valueAt: valueAt, requiredMonthly: requiredMonthly,
    requiredExtraFirst: requiredExtraFirst, monthsToAmount: monthsToAmount,
    deductionsEarned: deductionsEarned, plan: plan
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = CALC;
