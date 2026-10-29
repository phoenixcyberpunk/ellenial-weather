// Ellenial Weather — page behaviour.
// Skeleton: tabs, today's date, empty week tables. Forecast data comes in build step 2.

(function () {
  "use strict";

  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ROWS = ["Weather", "Temp °C", "Rain mm", "Wind m/s", "How sure"];

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
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  }

  var monday = new Date(today);
  monday.setDate(today.getDate() - dowIndex);

  var weeksEl = document.getElementById("weeks");
  ["This week", "Next week", "In two weeks"].forEach(function (title, w) {
    var start = new Date(monday);
    start.setDate(monday.getDate() + w * 7);
    var end = new Date(start);
    end.setDate(start.getDate() + 6);

    var card = document.createElement("article");
    card.className = "card tight";

    var head = document.createElement("div");
    head.className = "week-head";
    var h2 = document.createElement("h2");
    h2.className = "title";
    h2.textContent = title;
    var dates = document.createElement("span");
    dates.className = "week-dates";
    dates.textContent = "v" + isoWeek(start) + " · " + start.getDate() + " " + MONTHS[start.getMonth()] +
      "–" + end.getDate() + " " + MONTHS[end.getMonth()];
    head.appendChild(h2);
    head.appendChild(dates);
    card.appendChild(head);

    var table = document.createElement("table");
    table.className = "week";
    var caption = document.createElement("caption");
    caption.className = "visually-hidden";
    caption.hidden = true;
    caption.textContent = title;
    table.appendChild(caption);

    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "row-label";
    corner.setAttribute("aria-hidden", "true");
    hr.appendChild(corner);

    var cols = [];
    for (var i = 0; i < 7; i++) {
      var day = new Date(start);
      day.setDate(start.getDate() + i);
      var isToday = day.getTime() === today.getTime();
      var isPast = day < today;
      cols.push({ isToday: isToday, isPast: isPast });

      var th = document.createElement("th");
      th.scope = "col";
      th.setAttribute("aria-label", FULL[i] + " " + day.getDate());
      if (isToday) th.className = "today";
      else if (isPast) th.className = "past";
      th.innerHTML = '<span class="dow"></span><span class="date"></span>';
      th.querySelector(".dow").textContent = DOW[i];
      th.querySelector(".date").textContent = day.getDate();
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    ROWS.forEach(function (label) {
      var tr = document.createElement("tr");
      var rh = document.createElement("th");
      rh.scope = "row";
      rh.className = "row-label";
      rh.textContent = label;
      tr.appendChild(rh);
      cols.forEach(function (c) {
        var td = document.createElement("td");
        td.textContent = "–";
        if (c.isToday) td.className = "today-col";
        else if (c.isPast) td.className = "past";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    card.appendChild(table);
    weeksEl.appendChild(card);
  });

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

  var WORDS = { SUN: "Sunny", CLEAR: "Clear", MIX: "Some cloud", CLOUDY: "Grey", RAIN: "Wet", SNOW: "Snowy", WIND: "Windy" };

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
    nowCard.line.textContent = (WORDS[now.word] || "Mixed") + " and " + feel(now.temp) +
      (now.wind !== null ? " · " + now.wind + " m/s" : "");

    var today = hours.filter(function (h) { return clock(h.t).day === local.day; });
    var temps = today.map(function (h) { return h.temp; });
    var ahead = today.filter(function (h) { return h.t >= slot; });
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

    var okCount = data.sources.filter(function (s) { return s.ok; }).length;
    document.getElementById("source-count").textContent = "Combined from " + okCount + " forecasts. ";
  }

  function fail() {
    nowCard.line.textContent = "The forecasts couldn't be reached";
    nowCard.sub.textContent = "Try again in a little while.";
  }

  fetch("/api/forecast?lat=" + PLACE.lat + "&lon=" + PLACE.lon)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(fail);
})();
