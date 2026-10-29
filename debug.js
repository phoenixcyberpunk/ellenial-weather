// Temporary debug mode, only with ?debug in the address: a box at the bottom of the page
// logs every tap the page receives and any error, so a phone screenshot shows what broke.
(function () {
  if (!/[?&]debug\b/.test(location.search)) return;
  var box = document.createElement("pre");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = "position:fixed;left:6px;right:6px;bottom:6px;max-height:34vh;overflow:auto;margin:0;padding:8px;" +
    "font:11px/1.35 ui-monospace,Menlo,monospace;background:rgba(20,16,30,.92);color:#F3EEF8;border-radius:10px;" +
    "z-index:9999;white-space:pre-wrap;pointer-events:none";
  var lines = [];
  function log(s) {
    var t = new Date();
    lines.push(String(t.getMinutes()).padStart(2, "0") + ":" + String(t.getSeconds()).padStart(2, "0") + " " + s);
    if (lines.length > 14) lines.shift();
    box.textContent = lines.join("\n");
  }
  function describe(el) {
    if (!el || !el.tagName) return String(el);
    var b = el.closest && el.closest("button");
    var s = el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "");
    if (b) s += " in button[" + (b.getAttribute("aria-label") || b.textContent.trim()).slice(0, 22) + "]" + (b.disabled ? " DISABLED" : "");
    return s;
  }
  window.addEventListener("error", function (e) { log("ERROR " + e.message + " @" + (e.lineno || "?")); });
  window.addEventListener("unhandledrejection", function (e) { log("PROMISE " + (e.reason && e.reason.message || e.reason)); });
  ["touchstart", "touchend", "click"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var p = e.changedTouches ? e.changedTouches[0] : e;
      log(type + " " + Math.round(p.clientX) + "," + Math.round(p.clientY) + " " + describe(e.target));
    }, true);
  });
  document.addEventListener("click", function () {
    setTimeout(function () {
      var open = document.querySelectorAll(".day-btn[aria-pressed=true]").length;
      log("  -> open days: " + open + ", hour panels: " + document.querySelectorAll(".day-hours").length +
        ", scrollY " + Math.round(window.scrollY) + ", zoom " + (window.visualViewport ? window.visualViewport.scale.toFixed(2) : "?"));
    }, 0);
  }, true);
  function start() { document.body.appendChild(box); log("debug on · " + navigator.userAgent.replace(/.*(iPhone OS [\d_]+|Android [\d.]+|Version\/[\d.]+).*/, "$1")); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
