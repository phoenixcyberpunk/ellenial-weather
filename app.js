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

  // Auto / Light / Dark, the shared Ellenial switch (ellenial-theme.js), saved on this phone only.
  var prefs = document.getElementById("prefs");
  if (prefs && window.EllenialTheme) {
    prefs.appendChild(window.EllenialTheme.control({
      label: "Theme", separator: " · ", autoHint: "Follows your phone",
      labels: { auto: "Auto", light: "Light", dark: "Dark" },
    }));
  } else if (prefs) {
    prefs.hidden = true;
  }

  // The page always opens on today's forecast unless the link says otherwise.
  show(location.hash === "#usually" ? "usually" : "forecast");

  // ---- Today ------------------------------------------------------------
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var dowIndex = (today.getDay() + 6) % 7; // Monday = 0


  var hoursEl = document.getElementById("today-hours");

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

  // Weather icons, hand-drawn by Ellen in Procreate (art/weather-icons). The icon is decoration:
  // the words around it (aria-labels, the "Sunny and mild" line) always say the same thing.
  // Partly cloudy and clear show the moon after dark. On breezy hours that aren't already
  // "windy", a little wind spiral sits in the corner of the sun or cloud, so they're never hidden.
  var BREEZE = 6; // m/s; WIND (the big swoops) starts at 10, set in lib/combine.js
  var SPOKEN = { THUNDER: "thunder", SUN: "sunny", CLEAR: "clear", MIX: "partly cloudy", CLOUDY: "grey", RAIN: "rain", SNOW: "snow", WIND: "windy" };
  function iconName(word, day) {
    if (word === "SUN") return "sun";
    if (word === "CLEAR") return "clear";
    if (word === "MIX") return day === false ? "mix-night" : "mix-day";
    if (word === "CLOUDY") return "cloudy";
    if (word === "RAIN") return "rain";
    if (word === "SNOW") return "snow";
    if (word === "WIND") return "wind";
    if (word === "THUNDER") return "thunder";
    return null;
  }
  var CALM = { SUN: 1, CLEAR: 1, MIX: 1, CLOUDY: 1 }; // the badge sits on the sun or cloud only, never on rain, snow or thunder
  function isBreezy(word, wind) { return CALM[word] === 1 && wind !== null && wind !== undefined && wind >= BREEZE; }
  function spokenWeather(word, wind) {
    return (SPOKEN[word] || "changeable") + (isBreezy(word, wind) ? ", breezy" : "");
  }
  function weatherIcon(word, day, wind, cls) {
    var box = el("span", "w-icon" + (cls ? " " + cls : ""));
    box.setAttribute("aria-hidden", "true");
    var name = iconName(word, day);
    if (!name) { box.textContent = "–"; return box; }
    var img = el("img", "w-main"); img.src = "icons/w/" + name + ".png"; img.alt = ""; img.decoding = "async";
    box.appendChild(img);
    if (isBreezy(word, wind)) {
      var b = el("img", "w-breeze"); b.src = "icons/w/breeze.png"; b.alt = ""; b.decoding = "async";
      box.appendChild(b);
    }
    return box;
  }

  // Hours as a chart you scroll sideways, used by the Today card and by a tapped day. Temperature
  // is a line with its value written above each point; rain is a bar with the mm written under it
  // (never colour alone). items: { time, now, temp, mm, wind, word }.
  var COL = 52, LINE_H = 56;
  var placeHour = function () { return new Date().getHours(); }; // replaced by the place's own clock once data arrives
  function hourChart(items, label, startIdx) {
    var hours = items.filter(function (h) { return h.temp !== null && h.temp !== undefined; });
    var scroller = el("div", "hour-scroll");
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", label + ", every hour. Scroll sideways.");
    scroller.tabIndex = 0;
    if (!hours.length) return scroller;
    var track = el("div", "hour-track");
    track.style.width = hours.length * COL + "px";

    var times = el("div", "hour-cols hour-times");
    hours.forEach(function (h) {
      var t = el("span", "hour-time" + (h.now ? " now" : ""), h.now ? "Now" : h.time);
      t.setAttribute("aria-hidden", "true");
      times.appendChild(t);
    });
    track.appendChild(times);

    var temps = hours.map(function (h) { return h.temp; });
    var hi = Math.max.apply(null, temps), lo = Math.min.apply(null, temps), span = Math.max(hi - lo, 4);
    var mid = (hi + lo) / 2;
    function y(t) { return Math.round(LINE_H / 2 - ((t - mid) / span) * (LINE_H - 30)) + 8; }
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "hour-line");
    svg.setAttribute("width", hours.length * COL);
    svg.setAttribute("height", LINE_H + 8);
    svg.setAttribute("aria-hidden", "true");
    var poly = document.createElementNS(NS, "polyline");
    poly.setAttribute("points", hours.map(function (h, i) { return (i * COL + COL / 2) + "," + y(h.temp); }).join(" "));
    svg.appendChild(poly);
    hours.forEach(function (h, i) {
      var cx = i * COL + COL / 2, cy = y(h.temp);
      var dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("r", 3.5);
      svg.appendChild(dot);
      var txt = document.createElementNS(NS, "text");
      txt.setAttribute("x", cx); txt.setAttribute("y", cy - 8);
      txt.textContent = Math.round(h.temp) + "°";
      svg.appendChild(txt);
    });
    track.appendChild(svg);

    var cols = el("div", "hour-cols");
    var maxMm = Math.max(2, Math.max.apply(null, hours.map(function (h) { return h.mm || 0; })));
    hours.forEach(function (h) {
      var mm = h.mm >= 0.1 ? Math.round(h.mm * 10) / 10 : 0;
      var col = el("div", "hour-col" + (h.now ? " now" : ""));
      col.setAttribute("role", "group");
      col.setAttribute("aria-label", (h.now ? "Now" : h.time) + ": " + spokenWeather(h.word, h.wind) + ", " + Math.round(h.temp) + " degrees, " +
        mm + " millimetres, wind " + (h.wind === null || h.wind === undefined ? "unknown" : h.wind + " metres per second"));
      col.appendChild(weatherIcon(h.word, h.isDay, h.wind, "hour-icon"));
      var barBox = el("div", "rain-bar-box"); barBox.setAttribute("aria-hidden", "true");
      if (mm > 0) {
        var bar = el("div", "rain-bar");
        bar.style.height = Math.max(3, Math.round((mm / maxMm) * 100)) + "%";
        barBox.appendChild(bar);
      }
      col.appendChild(barBox);
      var r = el("span", "hour-small hour-rain" + (mm >= 1 ? " wet" : ""), mm + " mm"); r.setAttribute("aria-hidden", "true");
      col.appendChild(r);
      var wd = el("span", "hour-small", h.wind === null || h.wind === undefined ? "– m/s" : h.wind + " m/s"); wd.setAttribute("aria-hidden", "true");
      col.appendChild(wd);
      cols.appendChild(col);
    });
    track.appendChild(cols);
    scroller.appendChild(track);
    // Jump straight to the start column, never smooth-scrolled (iPhone taps).
    var idx = Math.min(startIdx || 0, hours.length - 1);
    requestAnimationFrame(function () { scroller.scrollLeft = idx * COL; });

    // A chart that runs past midnight gets a day label above it that follows the scroll,
    // so it always names the day you're looking at ("Thu 5 Nov" → "Fri 6 Nov").
    var days = hours.map(function (h) { return h.day; });
    var multiDay = days[0] && days.some(function (d) { return d !== days[0]; });
    var wrap = el("div", "hour-chart");
    var top = el("div", "hour-top" + (multiDay ? "" : " only-nav"));
    var dayEl = el("p", "hour-day", multiDay ? days[idx] : "");
    if (multiDay) dayEl.setAttribute("aria-live", "polite");
    function follow() {
      if (!multiDay) return;
      // The day of the column in the middle of what's showing.
      var mid = Math.floor((scroller.scrollLeft + scroller.clientWidth / 2) / COL);
      var d = days[Math.max(0, Math.min(days.length - 1, mid))];
      if (dayEl.textContent !== d) dayEl.textContent = d;
    }
    scroller.addEventListener("scroll", follow, { passive: true });
    requestAnimationFrame(follow);
    top.appendChild(dayEl);

    // Earlier / later buttons for a mouse, which can't swipe sideways. Shown only where the
    // pointer is a mouse or trackpad (CSS), so phones keep the plain swipe.
    var nav = el("div", "hour-nav");
    [["‹", "Earlier hours", -1], ["›", "Later hours", 1]].forEach(function (b) {
      var btn = el("button", "hour-nav-btn", b[0]);
      btn.type = "button";
      btn.setAttribute("aria-label", b[1]);
      btn.addEventListener("click", function () {
        var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        scroller.scrollBy({ left: b[2] * Math.max(COL, Math.floor(scroller.clientWidth / COL) - 1) * COL, behavior: still ? "auto" : "smooth" });
      });
      nav.appendChild(btn);
    });
    function edges() {
      nav.children[0].disabled = scroller.scrollLeft <= 2;
      nav.children[1].disabled = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
    }
    scroller.addEventListener("scroll", edges, { passive: true });
    requestAnimationFrame(edges);
    top.appendChild(nav);

    wrap.appendChild(top);
    wrap.appendChild(scroller);
    return wrap;
  }

  // A tapped day: starts at now (today) or 06 (other days).
  function hourPanel(day) {
    var panel = el("div", "day-hours");
    var d = parseDate(day.date);
    var name = FULL[(d.getUTCDay() + 6) % 7] + " " + d.getUTCDate();
    panel.appendChild(el("p", "day-hours-title", name + ", hour by hour"));
    var nowHour = day.today ? placeHour() : -1;
    var items = day.hours.filter(function (h) { return h.temp !== null; }).map(function (h) {
      return { time: pad(h.hour), now: h.hour === nowHour, temp: h.temp, mm: h.mm, wind: h.wind, word: h.word, isDay: h.day, hour: h.hour };
    });
    var startHour = nowHour >= 0 ? Math.max(0, nowHour - 1) : 6, idx = 0;
    items.forEach(function (h, i) { if (h.hour <= startHour) idx = i; });
    panel.appendChild(hourChart(items, name, idx));
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
        // Today says so in words, not only with the indigo fill (never colour alone).
        btn.appendChild(el("span", "dow", d.today ? "Today" : DOW[i]));
        if (d.today) th.setAttribute("aria-current", "date");
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
          // Tapping anywhere in a day's column opens it too, not just its date (Ellen's phone test:
          // her taps landed on the numbers). The date button stays the keyboard/screen-reader control.
          if (!d.empty) {
            td.classList.add("tappable");
            td.addEventListener("click", function () { setOpen(open === d.date ? null : d.date, "tap"); });
          }
          tr.appendChild(td);
          cols[i].push(td);
        });
        tbody.appendChild(tr);
      }
      row("Weather", function (d) { return weatherIcon(d.word, true, d.wind, "week-icon"); },
        function (d) { return spokenWeather(d.word, d.wind); });
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
        // Past days get a ✓ (measured), so "past" never rests on the grey alone; the note names the station.
        if (d.sure === null || d.sure === undefined) return d.past ? el("span", "measured", "✓") : "";
        var s = el("span", "sure");
        s.setAttribute("aria-label", ["", "less sure", "fairly sure", "sure"][d.sure]);
        s.appendChild(el("span", "sure-on", "●".repeat(d.sure)));
        s.appendChild(el("span", "sure-off", "○".repeat(3 - d.sure))); // hollow, not just paler
        return s;
      }, function (d) { return d.sure ? ["", "less sure", "fairly sure", "sure"][d.sure] : "measured"; });
      table.appendChild(tbody);
      card.appendChild(table);

      var legend = el("p", "week-legend");
      legend.setAttribute("aria-hidden", "true"); // the cells already say this to screen readers
      legend.appendChild(document.createTextNode("High/low °C · rain mm · wind m/s · "));
      var dots = el("span", "sure-on", "●●●"); legend.appendChild(dots);
      legend.appendChild(document.createTextNode(" how sure"));
      if (week.some(function (d) { return d.past && !d.empty && (d.sure === null || d.sure === undefined); })) {
        legend.appendChild(document.createTextNode(" · "));
        legend.appendChild(el("span", "measured", "✓"));
        legend.appendChild(document.createTextNode(" measured"));
      }
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

  var WORDS = { THUNDER: "Thundery", SUN: "Sunny", CLEAR: "Clear", MIX: "Partly cloudy", CLOUDY: "Grey", RAIN: "Wet", SNOW: "Snowy", WIND: "Windy" };

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
    nowCard.chip.textContent = "";
    nowCard.chip.appendChild(weatherIcon(now.word, now.day, now.wind, "now-icon"));
    nowCard.line.textContent = (WORDS[now.word] || "Changeable") + (isBreezy(now.word, now.wind) ? ", breezy" : "") + " and " + feel(now.temp) +
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

    // Today hour by hour: every hour of today and on through the next 24, opening at now.
    var until = slot + 24 * HOUR, nowIdx = 0;
    var items = hours.filter(function (h) { return h.t <= until && h.temp !== null && h.temp !== undefined; }).map(function (h, i) {
      var c = clock(h.t);
      if (h.t === slot) nowIdx = i;
      var nextDay = c.day !== local.day && c.hour === 0;
      var cd = parseDate(c.day);
      return { time: nextDay ? DOW[(cd.getUTCDay() + 6) % 7] : c.hh, now: h.t === slot, temp: h.temp, mm: h.mm, wind: h.wind, word: h.word, isDay: h.day,
        day: DOW[(cd.getUTCDay() + 6) % 7] + " " + cd.getUTCDate() + " " + MONTHS[cd.getUTCMonth()] };
    });
    hoursEl.textContent = "";
    hoursEl.appendChild(hourChart(items, "Today", Math.max(0, nowIdx - 1)));

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
    placeHour = function () { return clock(Date.now()).hour; };
    if (data.days && data.days.length === 21) renderWeeks(data.days, data.observedAt);

    var okCount = data.sources.filter(function (s) { return s.ok; }).length;
    document.getElementById("source-count").textContent = "Combined from " + okCount + (okCount === 1 ? " forecast. " : " forecasts. ");
  }

  function fail() {
    nowCard.line.textContent = "The forecasts couldn't be reached";
    nowCard.sub.textContent = "Try again in a little while.";
    document.getElementById("loading").textContent = "The forecasts couldn't be reached. Try again in a little while.";
  }

  // Load the forecast for the chosen place; a newer load wins if the place changes mid-way.
  var loadSeq = 0;
  function load() {
    var place = window.EllenialPlace.get(), mine = ++loadSeq;
    fetch("/api/forecast?lat=" + place.lat + "&lon=" + place.lon)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { if (mine === loadSeq) render(data); })
      .catch(function () { if (mine === loadSeq) fail(); });
  }

  window.EllenialPlace.onChange(function () {
    var loading = document.getElementById("loading");
    loading.textContent = "Fetching six forecasts…";
    loading.hidden = false;
    nowCard.temp.textContent = "–°";
    nowCard.line.textContent = "Fetching the forecasts…";
    nowCard.sub.textContent = "High – · low –";
    hoursEl.textContent = "";
    rainToggle.disabled = true;
    renderWeeks(placeholderDays(), null);
    load();
  });

  load();
})();
