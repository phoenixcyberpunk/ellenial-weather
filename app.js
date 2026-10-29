// Ellenial Weather — page behaviour.
// Skeleton: tabs, today's date, empty week tables. Forecast data comes in build step 2.

(function () {
  "use strict";

  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // ---- Tabs -------------------------------------------------------------
  var tabs = {
    forecast: { tab: document.getElementById("tab-forecast"), view: document.getElementById("view-forecast") },
    usually: { tab: document.getElementById("tab-usually"), view: document.getElementById("view-usually") }
  };

  function show(name, focus) {
    Object.keys(tabs).forEach(function (key) {
      var on = key === name;
      tabs[key].tab.setAttribute("aria-selected", on ? "true" : "false");
      tabs[key].tab.tabIndex = on ? 0 : -1;
      tabs[key].view.hidden = !on;
    });
    if (focus) tabs[name].tab.focus();
    var hash = name === "usually" ? "#usually" : "";
    if (location.hash !== hash) history.replaceState(null, "", location.pathname + hash);
  }

  tabs.forecast.tab.addEventListener("click", function () { show("forecast"); });
  tabs.usually.tab.addEventListener("click", function () { show("usually"); });

  // Arrow keys move between the two tabs.
  document.querySelector(".tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    show(tabs.forecast.tab.getAttribute("aria-selected") === "true" ? "usually" : "forecast", true);
  });

  document.querySelectorAll("[data-go]").forEach(function (el) {
    el.addEventListener("click", function () {
      show(el.getAttribute("data-go"), true);
      window.scrollTo(0, 0);
    });
  });

  // The page always opens on today's forecast unless the link says otherwise.
  show(location.hash === "#usually" ? "usually" : "forecast");

  // ---- Today ------------------------------------------------------------
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var dowIndex = (today.getDay() + 6) % 7; // Monday = 0

  document.getElementById("today-label").textContent =
    DOW[dowIndex] + " " + today.getDate() + " " + MONTHS[today.getMonth()];

  var hoursEl = document.getElementById("today-hours");

  function renderHours(cells) {
    hoursEl.textContent = "";
    cells.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "hour";
      div.innerHTML =
        '<span class="hour-time"></span><span class="hour-word"></span><span class="hour-temp"></span>' +
        '<span class="hour-small hour-rain"></span><span class="hour-small"></span>';
      var spans = div.querySelectorAll("span");
      spans[0].textContent = c.time;
      spans[1].textContent = c.word;
      spans[1].setAttribute("data-w", c.word);
      spans[2].textContent = c.temp;
      spans[3].textContent = c.rain;
      if (c.wet) spans[3].classList.add("wet");
      spans[4].textContent = c.wind;
      hoursEl.appendChild(div);
    });
  }

  // Placeholders while the forecast loads.
  renderHours(["Now", "", "", "", "", ""].map(function (t) {
    return { time: t || "–", word: "–", temp: "–", rain: "– mm", wind: "– m/s" };
  }));

  // ---- Week tables (this week, next week, the week after) ----------------
  // Mon–Sun across the top, one row per measure. Past days show what was measured
  // (greyed), today is highlighted, days beyond the forecasts show a dash.
  // Tapping a day shows it hour by hour under that week.
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  }
  function parseDate(s) { var p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Placeholder days from the visitor's own clock, until the forecast arrives.
  function placeholderDays() {
    var mon = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - dowIndex));
    var todayIso = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());
    var out = [];
    for (var i = 0; i < 21; i++) {
      var d = new Date(mon); d.setUTCDate(mon.getUTCDate() + i);
      var iso = d.toISOString().slice(0, 10);
      out.push({ date: iso, past: iso < todayIso, today: iso === todayIso, empty: true });
    }
    return out;
  }

  var weeksEl = document.getElementById("weeks");
  var selected = {}; // open day per week (0, 1, 2): its date string
  var observedSlow = false;

  function cell(content, cls) {
    var td = document.createElement("td");
    if (cls) td.className = cls;
    if (typeof content === "string") td.textContent = content;
    else if (content) td.appendChild(content);
    return td;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function hourPanel(day) {
    var panel = el("div", "day-hours");
    var d = parseDate(day.date);
    panel.appendChild(el("p", "day-hours-title", FULL[(d.getUTCDay() + 6) % 7] + " " + d.getUTCDate() + ", hour by hour"));
    var grid = el("div", "day-hours-grid");
    day.hours.forEach(function (h) {
      var box = el("div", "hour");
      box.appendChild(el("span", "hour-time", pad(h.hour)));
      var w = el("span", "hour-word", h.temp === null ? "–" : h.word);
      if (h.temp !== null) w.setAttribute("data-w", h.word);
      box.appendChild(w);
      box.appendChild(el("span", "hour-temp", h.temp === null ? "–" : Math.round(h.temp) + "°"));
      var r = el("span", "hour-small hour-rain", h.mm === null || h.mm === undefined ? "– mm" : (h.mm >= 0.1 ? h.mm : 0) + " mm");
      if (h.mm >= 1) r.classList.add("wet");
      box.appendChild(r);
      box.appendChild(el("span", "hour-small", h.wind === null || h.wind === undefined ? "– m/s" : h.wind + " m/s"));
      grid.appendChild(box);
    });
    panel.appendChild(grid);
    return panel;
  }

  function renderWeeks(days, observedAt) {
    weeksEl.textContent = "";
    ["This week", "Next week", "In two weeks"].forEach(function (title, w) {
      var week = days.slice(w * 7, w * 7 + 7);
      var open = selected[w] || null;
      var start = parseDate(week[0].date), end = parseDate(week[6].date);

      var card = el("article", "card tight");
      var head = el("div", "week-head");
      head.appendChild(el("h2", "title", title));
      head.appendChild(el("span", "week-dates", "v" + isoWeek(start) + " · " + start.getUTCDate() + " " + MONTHS[start.getUTCMonth()] +
        "–" + end.getUTCDate() + " " + MONTHS[end.getUTCMonth()]));
      card.appendChild(head);

      var table = el("table", "week");
      var cap = el("caption", "sr-only", title);
      table.appendChild(cap);
      var thead = el("thead"), hr = el("tr");
      var classes = week.map(function (d) { return d.today ? "today-col" : d.past ? "past" : d.empty ? "beyond" : ""; });

      var ths = [], btns = [], cols = week.map(function () { return []; });
      var slot = el("div", "day-hours-slot"); // where the open day's hours go

      // Open or close a day in place: nothing is rebuilt, so the tapped button stays put.
      function setOpen(date, how) {
        open = date;
        selected[w] = date;
        week.forEach(function (d, i) {
          var on = open === d.date;
          btns[i].setAttribute("aria-pressed", on ? "true" : "false");
          ths[i].classList.toggle("picked", on);
          cols[i].forEach(function (td) { td.classList.toggle("picked", on); });
        });
        slot.textContent = "";
        var pickNow = week.filter(function (d) { return d.date === open && !d.empty; })[0];
        if (pickNow && pickNow.hours) {
          slot.appendChild(hourPanel(pickNow));
          if (how) showWhole(slot);
        }
      }

      week.forEach(function (d, i) {
        var th = el("th"); th.scope = "col";
        var dd = parseDate(d.date);
        var btn = el("button", "day-btn");
        btn.type = "button";
        btn.disabled = !!d.empty;
        btn.setAttribute("aria-pressed", open === d.date ? "true" : "false");
        btn.setAttribute("aria-label", FULL[i] + " " + dd.getUTCDate() + (d.empty ? "" : ", show hours"));
        btn.appendChild(el("span", "dow", DOW[i]));
        btn.appendChild(el("span", "date", String(dd.getUTCDate())));
        btn.addEventListener("click", function () {
          setOpen(open === d.date ? null : d.date, "tap");
        });
        th.className = (d.today ? "today" : d.past ? "past" : "") + (open === d.date ? " picked" : "");
        th.appendChild(btn);
        hr.appendChild(th);
        ths.push(th); btns.push(btn);
      });
      thead.appendChild(hr);
      table.appendChild(thead);

      var tbody = el("tbody");
      // No visible row labels (the legend under the table explains them);
      // each cell tells screen readers what it holds instead.
      function row(label, fn, spoken) {
        var tr = el("tr");
        week.forEach(function (d, i) {
          var cls = classes[i] + (open === d.date ? " picked" : "");
          var td = d.empty ? cell("–", cls) : cell(fn(d), cls);
          td.setAttribute("aria-label", d.empty ? label + ": no forecast yet" : label + ": " + spoken(d));
          tr.appendChild(td);
          cols[i].push(td);
        });
        tbody.appendChild(tr);
      }
      row("Weather", function (d) { var c = el("span", "week-word", d.word); c.setAttribute("data-w", d.word); return c; },
        function (d) { return d.word.toLowerCase(); });
      row("Temperature", function (d) {
        var f = document.createDocumentFragment();
        f.appendChild(el("span", "week-hi", Math.round(d.hi) + "°"));
        f.appendChild(el("span", "week-lo", Math.round(d.lo) + "°"));
        return f;
      }, function (d) { return "high " + Math.round(d.hi) + ", low " + Math.round(d.lo) + " degrees"; });
      row("Rain", function (d) {
        if (d.mm === null || d.mm === undefined) return "–";
        var s = el("span", d.mm >= 1 ? "wet" : "", String(d.mm >= 0.1 ? (d.mm >= 10 ? Math.round(d.mm) : d.mm) : 0));
        return s;
      }, function (d) { return d.mm === null || d.mm === undefined ? "unknown" : (d.mm >= 0.1 ? d.mm : 0) + " millimetres"; });
      row("Wind", function (d) { return d.wind === null ? "–" : String(d.wind); },
        function (d) { return d.wind === null ? "unknown" : d.wind + " metres per second"; });
      row("How sure", function (d) {
        if (d.sure === null || d.sure === undefined) return ""; // past days: the note under the table says where they come from
        var s = el("span", "sure");
        s.setAttribute("aria-label", ["", "less sure", "fairly sure", "sure"][d.sure]);
        s.appendChild(el("span", "sure-on", "●".repeat(d.sure)));
        s.appendChild(el("span", "sure-off", "●".repeat(3 - d.sure)));
        return s;
      }, function (d) { return d.sure ? ["", "less sure", "fairly sure", "sure"][d.sure] : "measured"; });
      table.appendChild(tbody);
      card.appendChild(table);

      var legend = el("p", "week-legend");
      legend.setAttribute("aria-hidden", "true"); // the cells already say this to screen readers
      legend.appendChild(document.createTextNode("High/low °C · rain mm · wind m/s · "));
      var dots = el("span", "sure-on", "●●●"); legend.appendChild(dots);
      legend.appendChild(document.createTextNode(" how sure"));
      card.appendChild(legend);

      card.appendChild(slot);
      setOpen(open, null); // restore an open day after new data arrives, without scrolling

      if (w === 0 && week.some(function (d) { return d.past && !d.empty; })) {
        card.appendChild(el("p", "week-note", observedAt
          ? "Past days: measured at SMHI " + observedAt.name + "."
          : observedSlow
            ? "Past days: SMHI's station data was slow to answer, so these come from the forecasts' own records for now."
            : "Past days: from the forecasts' own records, no weather station nearby."));
      }
      weeksEl.appendChild(card);
    });
  }

  // Jump only as far as needed to show a just-opened day's hours in full. An instant jump
  // on purpose: on iPhone, a smooth programmatic scroll can leave taps landing in the wrong
  // place until you scroll by hand.
  function showWhole(node) {
    var r = node.getBoundingClientRect();
    var below = r.bottom - (window.innerHeight - 12);
    if (below > 0) window.scrollBy(0, Math.min(below, Math.max(0, r.top - 12)));
  }

  renderWeeks(placeholderDays(), null);

  // ---- Forecast: right now, today hour by hour, the rain line -----------
  var HOUR = 3600 * 1000;
  var PLACE = { name: "Gothenburg", lat: 57.71, lon: 11.97 };

  var nowCard = {
    temp: document.querySelector(".now-temp"),
    chip: document.querySelector(".now-text .chip"),
    line: document.querySelector(".now-line"),
    sub: document.querySelector(".now-sub")
  };
  var rainToggle = document.querySelector(".rain-toggle");
  var rainPanel = document.getElementById("rain-detail");
  var rainLabel = rainToggle.querySelector("span");
  var rainChevron = rainToggle.querySelector("[aria-hidden]");

  rainToggle.addEventListener("click", function () {
    var open = rainToggle.getAttribute("aria-expanded") !== "true";
    rainToggle.setAttribute("aria-expanded", open ? "true" : "false");
    rainPanel.hidden = !open;
    rainChevron.textContent = open ? "▲" : "▼";
  });

  // Local clock and calendar day at the place, whatever the visitor's own time zone is.
  function placeClock(tz) {
    var fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
    });
    return function (t) {
      var p = {};
      fmt.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
      return { day: p.year + "-" + p.month + "-" + p.day, hour: Number(p.hour), hh: p.hour };
    };
  }

  var WORDS = { SUN: "Sunny", CLEAR: "Clear", MIX: "Partly cloudy", CLOUDY: "Grey", RAIN: "Wet", SNOW: "Snowy", WIND: "Windy" };

  function feel(temp) {
    if (temp <= 0) return "frosty";
    if (temp <= 5) return "cold";
    if (temp <= 12) return "mild";
    if (temp <= 20) return "pleasant";
    return "warm";
  }

  function deg(x) { return Math.round(x) + "°"; }
  function mmText(x) { return x === null || x === undefined ? "– mm" : (x >= 0.1 ? x : 0) + " mm"; }
  function isRainy(h) { return h.mm !== null && h.rainShare !== null && h.rainShare >= 0.5 && h.mm >= 0.1; }

  function rainSummary(windowHours, clock) {
    var rainy = windowHours.filter(isRainy);
    if (!rainy.length) {
      var maybe = windowHours.some(function (h) { return h.rainShare !== null && h.rainShare >= 0.3; });
      return maybe ? "probably dry, a small chance of a shower" : "dry";
    }
    var most = Math.max.apply(null, rainy.map(function (h) { return h.mm; }));
    var strength = most < 1 ? "light" : most < 4 ? "moderate" : "heavy";
    var first = rainy[0];
    if (first.t === windowHours[0].t) {
      // Raining now: say until when the first wet spell lasts.
      var end = first.t;
      for (var i = 0; i < windowHours.length && isRainy(windowHours[i]); i++) end = windowHours[i].t + HOUR;
      return i >= windowHours.length ? strength + ", on and off all day" : strength + " now, until about " + clock(end).hh + ":00";
    }
    return strength + ", likely from " + clock(first.t).hh + ":00";
  }

  function render(data) {
    var clock = placeClock(data.place.timezone);
    var nowT = Date.now();
    var hours = data.hours;
    var byT = {};
    hours.forEach(function (h) { byT[h.t] = h; });

    var slot = Math.floor(nowT / HOUR) * HOUR;
    var now = byT[slot] || hours.filter(function (h) { return h.t <= nowT; }).pop() || hours[0];
    var local = clock(nowT);

    // Right now
    nowCard.temp.textContent = deg(now.temp);
    nowCard.chip.textContent = now.word;
    nowCard.chip.setAttribute("data-w", now.word);
    nowCard.line.textContent = (WORDS[now.word] || "Changeable") + " and " + feel(now.temp) +
      (now.wind !== null ? " · " + now.wind + "\u00a0m/s" : "");

    var todayHours = hours.filter(function (h) { return clock(h.t).day === local.day; });
    var todayDay = (data.days || []).filter(function (d) { return d.today && !d.empty; })[0];
    var temps = todayDay ? [todayDay.hi, todayDay.lo] : todayHours.map(function (h) { return h.temp; });
    var ahead = todayHours.filter(function (h) { return h.t >= slot; });
    var sure = ahead.length ? ahead.reduce(function (a, h) { return a + h.sure; }, 0) / ahead.length : now.sure;
    var agree = sure >= 2.5 ? "forecasts agree" : sure >= 1.5 ? "forecasts mostly agree" : "forecasts differ";
    nowCard.sub.textContent = temps.length
      ? "High " + deg(Math.max.apply(null, temps)) + " · low " + deg(Math.min.apply(null, temps)) + " · " + agree
      : agree;

    // Today hour by hour: now, then every second hour.
    var cells = [];
    for (var k = 0; k < 6; k++) {
      var h = byT[slot + k * 2 * HOUR];
      if (!h) continue;
      cells.push({
        time: k === 0 ? "Now" : clock(h.t).hh,
        word: h.word,
        temp: deg(h.temp),
        rain: mmText(h.mm),
        wet: h.mm !== null && h.mm >= 1,
        wind: h.wind === null ? "– m/s" : h.wind + " m/s"
      });
    }
    renderHours(cells);

    // Rain line: rest of today, or tonight once it's evening.
    var evening = local.hour >= 18;
    var windowHours = hours.filter(function (h) {
      if (h.t < slot) return false;
      return evening ? h.t < slot + 12 * HOUR : clock(h.t).day === local.day;
    });
    var when = evening ? "tonight" : "today";
    rainLabel.innerHTML = "<b></b> ";
    rainLabel.querySelector("b").textContent = "Rain " + when + ":";
    rainLabel.appendChild(document.createTextNode(" " + rainSummary(windowHours, clock)));
    rainToggle.disabled = false;

    // One dot per forecast: filled when that forecast sees rain in the window.
    var dotsEl = document.getElementById("rain-dots");
    dotsEl.textContent = "";
    var seeing = 0, counted = 0;
    data.sources.filter(function (s) { return s.ok; }).forEach(function (s) {
      var has = false, total = 0;
      windowHours.forEach(function (h) {
        var v = h.mmBySource && h.mmBySource[s.id];
        if (v !== undefined) { has = true; total += v; }
      });
      if (!has) return;
      counted++;
      var wet = total >= 0.2;
      if (wet) seeing++;
      var dot = document.createElement("span");
      dot.className = "rain-dot" + (wet ? " on" : "");
      dot.title = s.name + (wet ? ": rain, about " + Math.round(total * 10) / 10 + " mm" : ": dry");
      dotsEl.appendChild(dot);
    });
    var totalMm = windowHours.reduce(function (a, h) { return a + (h.mm || 0); }, 0);
    document.getElementById("rain-text").textContent = seeing
      ? seeing + " of " + counted + " forecasts see rain " + when + ", about " + (Math.round(totalMm * 2) / 2 || 0.5) + " mm in total."
      : "None of the " + counted + " forecasts see rain " + when + ".";

    document.getElementById("loading").hidden = true;
    observedSlow = !!data.observedSlow;
    if (data.days && data.days.length === 21) renderWeeks(data.days, data.observedAt);

    var okCount = data.sources.filter(function (s) { return s.ok; }).length;
    document.getElementById("source-count").textContent = "Combined from " + okCount + " forecasts. ";
  }

  function fail() {
    nowCard.line.textContent = "The forecasts couldn't be reached";
    nowCard.sub.textContent = "Try again in a little while.";
    document.getElementById("loading").textContent = "The forecasts couldn't be reached. Try again in a little while.";
  }

  fetch("/api/forecast?lat=" + PLACE.lat + "&lon=" + PLACE.lon)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(fail);
})();
