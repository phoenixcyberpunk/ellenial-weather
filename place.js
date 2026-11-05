// Ellenial Weather — the chosen place.
// Search by name (through /api/places) or "Use my location". The choice, plus the last few
// places, stay in this browser only (localStorage); nothing about the visitor is sent or kept anywhere.
// app.js and usually.js read EllenialPlace.get() and reload when the place changes.

(function () {
  "use strict";

  var DEFAULT = { name: "Gothenburg", sub: "Västra Götaland, Sweden", lat: 57.71, lon: 11.97 };
  var KEY = "ellenial-weather-place", RECENT_KEY = "ellenial-weather-recent";
  var LANG = ((navigator.language || "en").slice(0, 2).toLowerCase().match(/^[a-z]{2}$/) || ["en"])[0];

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: works for this visit */ }
  }
  function valid(p) {
    return p && typeof p.name === "string" && isFinite(p.lat) && isFinite(p.lon) &&
      Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  }

  var current = read(KEY);
  if (!valid(current)) current = DEFAULT;
  var listeners = [];

  window.EllenialPlace = {
    get: function () { return current; },
    onChange: function (fn) { listeners.push(fn); }
  };

  function choose(p) {
    current = { name: p.name, sub: p.sub || "", lat: p.lat, lon: p.lon };
    write(KEY, current);
    var recent = (read(RECENT_KEY) || []).filter(function (r) { return valid(r) && !(r.lat === p.lat && r.lon === p.lon); });
    recent.unshift(current);
    write(RECENT_KEY, recent.slice(0, 4));
    showName();
    close();
    listeners.forEach(function (fn) { try { fn(current); } catch (e) { console.warn("place:", e); } });
  }

  // ---- The panel under the header -----------------------------------------
  var button, panel, input, list, status, geoBtn, timer = null, seq = 0;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function showName() {
    if (!button) return;
    button.querySelector(".place-name").textContent = current.name;
    button.setAttribute("aria-label", "Place: " + current.name + ". Change place");
  }

  function setStatus(text) { status.textContent = text || ""; status.hidden = !text; }

  function showList(places) {
    list.textContent = "";
    places.forEach(function (p) {
      var li = el("li");
      var b = el("button", "place-option");
      b.type = "button";
      b.appendChild(el("span", "place-option-name", p.name));
      if (p.sub) b.appendChild(el("span", "place-option-sub", p.sub));
      if (p.lat === current.lat && p.lon === current.lon) b.setAttribute("aria-current", "true");
      b.addEventListener("click", function () { choose(p); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  function showRecent() {
    var recent = (read(RECENT_KEY) || []).filter(valid);
    showList(recent.length ? recent : [DEFAULT]);
    setStatus("");
  }

  function search(q) {
    var mine = ++seq;
    fetch("/api/places?q=" + encodeURIComponent(q) + "&lang=" + LANG)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        if (mine !== seq) return; // a newer search has started
        showList(data.places || []);
        setStatus(data.places && data.places.length ? "" : "No places called “" + q + "”.");
      })
      .catch(function () {
        if (mine !== seq) return;
        list.textContent = "";
        setStatus("Place search couldn't be reached. Try again in a little while.");
      });
  }

  function onInput() {
    clearTimeout(timer);
    var q = input.value.trim();
    if (q.length < 2) { seq++; showRecent(); return; }
    timer = setTimeout(function () { search(q); }, 250);
  }

  function useLocation() {
    if (!navigator.geolocation) { setStatus("This browser can't share its location."); return; }
    geoBtn.disabled = true;
    setStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(function (pos) {
      geoBtn.disabled = false;
      // Rounded to about 1 km before it goes anywhere.
      choose({
        name: "Your location", sub: "",
        lat: Math.round(pos.coords.latitude * 100) / 100,
        lon: Math.round(pos.coords.longitude * 100) / 100
      });
    }, function (err) {
      geoBtn.disabled = false;
      setStatus(err && err.code === 1
        ? "Location is turned off for this page. Search by name instead."
        : "Your location couldn't be found. Search by name instead.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }

  function open() {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    input.value = "";
    showRecent();
    input.focus();
  }
  function close(returnFocus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }

  function build() {
    button = document.querySelector(".place");
    var name = el("span", "place-name");
    button.textContent = "";
    button.appendChild(name);
    button.appendChild(document.createTextNode(" ▾"));
    button.disabled = false;
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "place-panel");

    panel = el("div", "place-panel");
    panel.id = "place-panel";
    panel.hidden = true;
    var label = el("label", "sr-only", "Search for a town or village");
    label.htmlFor = "place-input";
    input = el("input", "place-input");
    input.id = "place-input";
    input.type = "search";
    input.placeholder = "Town or village";
    input.autocomplete = "off";
    input.setAttribute("enterkeyhint", "search");
    input.setAttribute("spellcheck", "false");
    geoBtn = el("button", "place-geo", "Use my location");
    geoBtn.type = "button";
    status = el("p", "place-status");
    status.setAttribute("role", "status");
    status.hidden = true;
    list = el("ul", "place-list");
    list.setAttribute("aria-label", "Places");

    panel.appendChild(label);
    panel.appendChild(input);
    panel.appendChild(geoBtn);
    panel.appendChild(status);
    panel.appendChild(list);
    document.querySelector(".top").insertAdjacentElement("afterend", panel);

    button.addEventListener("click", function () { panel.hidden ? open() : close(true); });
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var first = list.querySelector(".place-option");
        if (first && input.value.trim().length >= 2) first.click();
      }
    });
    geoBtn.addEventListener("click", useLocation);
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(true); });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) close(false);
    });
    showName();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
