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
  ["Now", "–", "–", "–", "–", "–"].forEach(function (t) {
    var div = document.createElement("div");
    div.className = "hour";
    div.innerHTML =
      '<span class="hour-time"></span><span class="hour-temp">–</span>' +
      '<span class="hour-small">– mm</span><span class="hour-small">– m/s</span>';
    div.querySelector(".hour-time").textContent = t;
    hoursEl.appendChild(div);
  });

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
})();
