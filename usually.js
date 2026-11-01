// Ellenial Weather — What usually happens. Odds from past weather, never predictions.
// Reads /api/history once (cached at the edge for weeks) and fills the second view, plus the
// "After the forecasts end" card on the Forecast view.
// Never colour alone: every number is written out; highlighted months also get bold, underlined labels.

(function () {
  "use strict";

  var PLACE = { lat: 57.7, lon: 12.0 }; // history is shared per 0.1°
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var LETTER = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  var LEAP_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

  var today = new Date();
  var thisMonth = today.getMonth() + 1;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function slotOf(d) { return LEAP_STARTS[d.getMonth()] + d.getDate() - 1; }
  function fmt(md) { return md ? md.day + " " + MON[md.month - 1] : null; }
  function deg(v) { return Math.round(v) + "°"; }
  function signed(v, unit) { return (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v) + unit; }
  function clearAfter(card, keep) {
    // Remove everything after the first `keep` children (the heading and its intro line).
    while (card.children.length > keep) card.removeChild(card.lastChild);
  }

  // "Measured at SMHI Göteborg A" / "From the ERA5 weather model" for each part, merged when shared.
  function sourceLine(parts, years) {
    var groups = [];
    parts.forEach(function (p) {
      if (!p.src) return;
      var name = p.src.kind === "station" ? "measured at " + p.src.name : "from the ERA5 weather model";
      var g = groups.filter(function (x) { return x.name === name; })[0];
      if (g) g.what.push(p.what); else groups.push({ name: name, what: [p.what] });
    });
    var text = groups.map(function (g) {
      var w = g.what.length > 1 ? g.what.slice(0, -1).join(", ") + " and " + g.what[g.what.length - 1] : g.what[0];
      return w.charAt(0).toUpperCase() + w.slice(1) + " " + g.name;
    }).join(". ");
    return text + (years ? ", " + years + "." : ".");
  }

  // ---- Usually this week, and the normals card on the Forecast view ------------------------
  function usualDays(days, start, n) {
    var hi = 0, lo = 0, rain = 0, sun = 0, c = 0;
    for (var k = 0; k < n; k++) {
      var d = days[(start + k) % 366];
      if (!d || d[0] === null) continue;
      hi += d[0]; lo += d[1]; rain += d[2] || 0; sun += d[3] || 0; c++;
    }
    return c ? { hi: hi / c, lo: lo / c, rain: rain / c, sun: sun / c } : null;
  }

  function renderWeek(h) {
    var u = usualDays(h.days, slotOf(today) - 3 + 366, 7);
    if (!u) return;
    $("u-week-title").textContent = "Usually around " + today.getDate() + " " + MON[today.getMonth()];
    $("u-temp").textContent = deg(u.hi) + " / " + deg(u.lo);
    $("u-rain").textContent = Math.round(u.rain * 7) + " of 7";
    $("u-sun").textContent = u.sun < 1 ? "under 1 h" : Math.round(u.sun) + " h";
    $("u-week-note").textContent = sourceLine([
      { what: "temperatures", src: h.sources.temps },
      { what: "rain", src: h.sources.rain },
      { what: "sunshine", src: h.sources.sun }
    ], h.years.from && h.years.to ? h.years.from + "–" + h.years.to : null);
  }

  function renderNormals(h) {
    // The forecasts reach about 16 days ahead; describe the week after that.
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 17);
    var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    var u = usualDays(h.days, slotOf(start), 7);
    if (!u) return;
    var range = start.getMonth() === end.getMonth()
      ? start.getDate() + "–" + end.getDate() + " " + MON[end.getMonth()]
      : start.getDate() + " " + MON[start.getMonth()] + " – " + end.getDate() + " " + MON[end.getMonth()];
    $("normals-text").textContent = "Around " + range + ", a usual day has a high of " + deg(u.hi) + " and a low of " + deg(u.lo) +
      ", rain on about " + Math.round(u.rain * 7) + " of 7 days and " + (u.sun < 1 ? "under an hour" : "about " + Math.round(u.sun) + " h") + " of sun.";
  }

  // ---- Frost ----------------------------------------------------------------------------
  // A strip from July to June: months where a frost night is possible (between the early first
  // frost and the safe last frost) get a snowflake and a soft fill; the word carries it too.
  function frostStrip(f) {
    var startM = f.firstAutumn.early ? f.firstAutumn.early.month : null;
    var endM = f.lastSpring.safe ? f.lastSpring.safe.month : null;
    var order = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
    var pos = function (m) { return order.indexOf(m); };
    var wrap = el("div", "strip");
    wrap.setAttribute("role", "img");
    var on = [];
    order.forEach(function (m) {
      var frosty = startM !== null && endM !== null && pos(m) >= pos(startM) && pos(m) <= pos(endM);
      if (frosty) on.push(MONTH[m - 1]);
      var cell = el("div", "strip-cell" + (frosty ? " frosty" : "") + (m === thisMonth ? " now" : ""));
      cell.appendChild(el("span", "strip-mark", frosty ? "❄" : ""));
      cell.appendChild(el("span", "strip-label", LETTER[m - 1]));
      wrap.appendChild(cell);
    });
    wrap.setAttribute("aria-label", on.length ? "Frost nights are possible from " + on[0] + " to " + on[on.length - 1] + "." : "No frost months.");
    return wrap;
  }

  function renderFrost(h) {
    var card = $("u-frost"), f = h.frost;
    clearAfter(card, 1);
    if (!f) { card.appendChild(el("p", "section-text muted", "Not enough years of data here for frost odds.")); return; }
    if (f.noFrostSeasons === f.seasons) {
      card.appendChild(el("p", "section-text", "No frost nights in the last " + f.seasons + " winters."));
      return;
    }
    card.appendChild(frostStrip(f));

    var autumn = el("div", "fact");
    autumn.appendChild(el("p", "fact-head", "First frost in autumn: usually around " + fmt(f.firstAutumn.typical)));
    var a = [];
    if (f.firstAutumn.early) a.push("by " + fmt(f.firstAutumn.early) + " in 3 of 10 years");
    a.push(f.firstAutumn.late ? "by " + fmt(f.firstAutumn.late) + " in 7 of 10" : "in fewer than 7 of 10 years at all");
    autumn.appendChild(el("p", "fact-sub", a.join(", ") + "."));
    card.appendChild(autumn);

    var spring = el("div", "fact");
    spring.appendChild(el("p", "fact-head", "Last frost in spring: usually around " + fmt(f.lastSpring.typical)));
    if (f.lastSpring.safe) {
      spring.appendChild(el("p", "fact-sub", "After " + fmt(f.lastSpring.safe) + " only 1 year in 10, so that's when frost-tender plants can usually go out."));
    }
    card.appendChild(spring);

    card.appendChild(el("p", "section-text", "About " + f.nightsPerYear + " frost nights a winter" +
      (f.noFrostSeasons ? "; " + f.noFrostSeasons + " of the last " + f.seasons + " winters had none." : ".")));
    card.appendChild(el("p", "caveat", "Frost here means below 0 °C at 2 m, as weather stations measure it. Frost on the ground, which nips plants, can come earlier in autumn and later in spring."));
    card.appendChild(el("p", "source-note", sourceLine([{ what: "nights", src: h.sources.temps }], "winters " + f.from + "/" + String(f.from + 1).slice(2) + " to " + (f.to - 1) + "/" + String(f.to).slice(2))));
  }

  // ---- Sunny days: a bar per month, its number written on top ---------------------------
  function renderSun(h) {
    var card = $("u-sun-card"), months = h.sun && h.sun.months;
    clearAfter(card, 2);
    if (!months || months.every(function (m) { return m.sunnyDays === null; })) return;
    var max = Math.max.apply(null, months.map(function (m) { return m.sunnyDays || 0; })) || 1;
    var chart = el("div", "bars");
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Sunny days per month: " + months.map(function (m) { return MONTH[m.month - 1] + " " + m.sunnyDays; }).join(", ") + ".");
    months.forEach(function (m) {
      var col = el("div", "bar-col" + (m.month === thisMonth ? " now" : ""));
      col.appendChild(el("span", "bar-value", m.sunnyDays === null ? "–" : String(m.sunnyDays)));
      var track = el("div", "bar-track");
      var bar = el("div", "bar");
      bar.style.height = Math.max(4, Math.round(((m.sunnyDays || 0) / max) * 100)) + "%";
      track.appendChild(bar);
      col.appendChild(track);
      col.appendChild(el("span", "bar-label", LETTER[m.month - 1]));
      chart.appendChild(col);
    });
    card.appendChild(chart);
    var best = months.slice().sort(function (a, b) { return b.sunnyDays - a.sunnyDays; })[0];
    var cur = months[thisMonth - 1];
    card.appendChild(el("p", "section-text", MONTH[thisMonth - 1] + " usually has " + cur.sunnyDays + " sunny days, about " +
      cur.hoursPerDay + " h of sun a day. Sunniest: " + MONTH[best.month - 1] + " (" + best.sunnyDays + ")."));
    if (h.sources.sun.kind === "model") {
      card.appendChild(el("p", "caveat", "There's no sunshine station near here, so these come from a weather model, which counts more sun than stations measure. Read them as sunnier than real."));
    }
    card.appendChild(el("p", "source-note", sourceLine([{ what: "sunshine", src: h.sources.sun }], h.sun.from + "–" + h.sun.to)));
  }

  // ---- UV: typical daily max per month ---------------------------------------------------
  function renderUv(h) {
    var card = $("u-uv"), uv = h.uv;
    clearAfter(card, 2);
    if (!uv) {
      card.appendChild(el("p", "caveat", "UV history couldn't be reached right now."));
      return;
    }
    var row = el("div", "uv-row");
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", "Typical highest UV of the day: " + uv.months.map(function (m) { return MONTH[m.month - 1] + " " + m.typical; }).join(", ") + ".");
    uv.months.forEach(function (m) {
      var care = m.care !== undefined ? m.care : m.typical !== null && m.typical >= 3;
      var cell = el("div", "uv-cell" + (care ? " care" : "") + (m.month === thisMonth ? " now" : ""));
      cell.appendChild(el("span", "uv-value", m.typical === null ? "–" : String(m.typical)));
      cell.appendChild(el("span", "uv-label", LETTER[m.month - 1]));
      row.appendChild(cell);
    });
    card.appendChild(row);
    card.appendChild(el("p", "uv-legend", "Outlined: UV 3 or more on a typical day"));
    if (uv.careFrom) {
      card.appendChild(el("p", "section-text", "From " + MONTH[uv.careFrom - 1] + " to " + MONTH[uv.careTo - 1] +
        ", a typical day reaches UV 3 or more, when sun protection is advised around midday. Clear days can be higher than this."));
    } else {
      card.appendChild(el("p", "section-text", "A typical day here stays below UV 3 all year. Clear summer days can still be higher."));
    }
    var since = new Date(uv.from + "T12:00:00");
    card.appendChild(el("p", "caveat", "UV has only been kept since " + MONTH[since.getMonth()] + " " + since.getFullYear() +
      " (forecast archive), far fewer years than temperature, so this is a rough guide."));
  }

  // ---- How it's changing ----------------------------------------------------------------
  function renderChange(h) {
    var card = $("u-change"), c = h.changing;
    clearAfter(card, 1);
    if (!c) { card.appendChild(el("p", "section-text muted", "Not enough years of data here to compare yet.")); return; }
    var head = c.warmer > 0 ? signed(c.warmer, "°") + " warmer than in the 1990s, on average over the year."
      : c.warmer < 0 ? signed(c.warmer, "°") + " colder than in the 1990s, on average." : "About the same average temperature as in the 1990s.";
    card.appendChild(el("p", "change-head", head));

    var t = el("table", "change");
    var thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "", ""));
    hr.appendChild(el("th", "", c.then.from + "–" + String(c.then.to).slice(2)));
    hr.appendChild(el("th", "", c.now.from + "–" + String(c.now.to).slice(2)));
    hr.firstChild.setAttribute("aria-label", "Measure");
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el("tbody");
    function row(label, a, b, unit) {
      if (a === null || a === undefined || b === null || b === undefined) return;
      var tr = el("tr");
      var th = el("th", "", label); th.scope = "row"; tr.appendChild(th);
      tr.appendChild(el("td", "", a + unit));
      tr.appendChild(el("td", "", b + unit));
      tb.appendChild(tr);
    }
    row("Average temperature", c.then.meanTemp, c.now.meanTemp, "°");
    row("Frost nights a year", c.then.frostNights, c.now.frostNights, "");
    row("Summer days (25°+) a year", c.then.summerDays, c.now.summerDays, "");
    row("Rainy days a year", c.then.rainyDays, c.now.rainyDays, "");
    t.appendChild(tb);
    card.appendChild(t);
    if (c.firstFrostLaterDays) {
      var d = c.firstFrostLaterDays;
      card.appendChild(el("p", "section-text", "The first autumn frost now comes about " + Math.abs(d) + " days " + (d > 0 ? "later" : "earlier") + " than in the 1990s."));
    }
    card.appendChild(el("p", "source-note", c.from === "station"
      ? sourceLine([{ what: "temperatures", src: h.sources.temps }, { what: "rain", src: h.sources.rain }], null)
      : "From the ERA5 weather model, which has no gaps or station moves over these years."));
  }

  function render(h) {
    $("usually-loading").hidden = true;
    var parts = [renderWeek, renderNormals, renderFrost, renderSun, renderUv, renderChange];
    parts.forEach(function (fn) {
      try { fn(h); } catch (e) { console.warn("usually:", fn.name, e); }
    });
  }

  function fail() {
    $("usually-loading").textContent = "The weather history couldn't be reached. Try again in a little while.";
  }

  fetch("/api/history?lat=" + PLACE.lat + "&lon=" + PLACE.lon)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(fail);
})();
