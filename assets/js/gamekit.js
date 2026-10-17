/* ============================================================
   GameKit — tiny shared toolkit for the built-in arcade.
   No dependencies. Everything the games need is here.
   ============================================================ */
window.GameKit = (function () {
  "use strict";

  var BEST_KEY = "madkid.arcade.best.v1";
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- best scores ---------- */
  function readAll() {
    try {
      var raw = window.localStorage.getItem(BEST_KEY);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  function getBest(id) {
    var value = readAll()[id];
    return typeof value === "number" && isFinite(value) ? value : null;
  }

  /* mode: "high" (default) or "low" (times, move counts) */
  function setBest(id, value, mode) {
    if (typeof value !== "number" || !isFinite(value)) return getBest(id);
    var record = getBest(id);
    var better = record === null || (mode === "low" ? value < record : value > record);
    if (!better) return record;
    var all = readAll();
    all[id] = value;
    try { window.localStorage.setItem(BEST_KEY, JSON.stringify(all)); } catch (e) { /* private mode */ }
    try {
      window.dispatchEvent(new CustomEvent("arcade:best", { detail: { id: id, best: value } }));
    } catch (e) { /* very old browser */ }
    return value;
  }

  function formatTime(seconds) {
    var s = Math.max(0, Math.round(seconds));
    var m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  /* ---------- dom helpers ---------- */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function isTyping(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }

  function clamp(n, min, max) {
    return n < min ? min : n > max ? max : n;
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /* ---------- canvas ---------- */
  function canvas(root, W, H) {
    root.classList.add("gk");
    var wrap = el("div", "gk-canvas");
    wrap.style.aspectRatio = W + " / " + H;
    var c = document.createElement("canvas");
    c.className = "gk-surface";
    c.width = Math.round(W * DPR);
    c.height = Math.round(H * DPR);
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", "Game area");
    wrap.appendChild(c);
    root.appendChild(wrap);

    var ctx = null;
    try { ctx = c.getContext("2d"); } catch (e) { ctx = null; }
    if (ctx && ctx.setTransform) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!ctx) {
      wrap.appendChild(el("p", "gk-fallback",
        "Canvas is not available in this browser. Open the page in Chrome, Edge, Firefox or Safari to play."));
    }

    return { canvas: c, ctx: ctx, wrap: wrap, W: W, H: H, dpr: DPR };
  }

  function point(canvasEl, event, W, H) {
    var rect = canvasEl.getBoundingClientRect();
    var w = rect.width || 1;
    var h = rect.height || 1;
    return {
      x: (event.clientX - rect.left) * (W / w),
      y: (event.clientY - rect.top) * (H / h)
    };
  }

  function roundedRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /* ---------- overlay (start / pause / game over) ---------- */
  function overlay(root) {
    var box = el("div", "gk-overlay");
    box.hidden = true;
    box.innerHTML =
      '<div class="gk-panel">' +
        '<p class="gk-kicker"></p>' +
        '<h2></h2>' +
        '<p class="gk-text"></p>' +
        '<button type="button" class="gk-btn"></button>' +
      '</div>';
    var kicker = box.querySelector(".gk-kicker");
    var heading = box.querySelector("h2");
    var text = box.querySelector(".gk-text");
    var button = box.querySelector(".gk-btn");
    var action = null;

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      if (action) action();
    });

    root.appendChild(box);

    return {
      el: box,
      show: function (opts) {
        opts = opts || {};
        kicker.textContent = opts.kicker || "";
        kicker.hidden = !opts.kicker;
        heading.textContent = opts.title || "";
        text.textContent = opts.text || "";
        text.hidden = !opts.text;
        if (opts.action && opts.onAction) {
          button.textContent = opts.action;
          button.hidden = false;
          action = opts.onAction;
        } else {
          button.hidden = true;
          action = null;
        }
        box.hidden = false;
      },
      hide: function () { box.hidden = true; },
      isShown: function () { return !box.hidden; }
    };
  }

  /* ---------- keyboard ---------- */
  /* opts: { down: fn(e), up: fn(e), prevent: ["ArrowUp", " "] } */
  function keys(opts) {
    opts = opts || {};
    var prevent = {};
    (opts.prevent || []).forEach(function (k) { prevent[k] = true; });

    function down(event) {
      if (isTyping(event.target)) return;
      if (prevent[event.key]) event.preventDefault();
      if (opts.down) opts.down(event);
    }
    function up(event) {
      if (isTyping(event.target)) return;
      if (prevent[event.key]) event.preventDefault();
      if (opts.up) opts.up(event);
    }

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return function off() {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }

  /* ---------- pointer / gesture helpers ---------- */
  function swipe(target, onSwipe) {
    var sx = 0, sy = 0, tracking = false;
    function start(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      tracking = true;
      sx = event.clientX;
      sy = event.clientY;
    }
    function end(event) {
      if (!tracking) return;
      tracking = false;
      var dx = event.clientX - sx;
      var dy = event.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) onSwipe(dx > 0 ? "right" : "left");
      else onSwipe(dy > 0 ? "down" : "up");
    }
    target.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", end);
    return function off() {
      target.removeEventListener("pointerdown", start);
      window.removeEventListener("pointerup", end);
    };
  }

  /* ---------- animation loop (dt in seconds, clamped) ---------- */
  function loop(frame) {
    var raf = 0;
    var last = 0;
    var stopped = false;
    function tick(now) {
      if (stopped) return;
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame(dt);
      raf = window.requestAnimationFrame(tick);
    }
    raf = window.requestAnimationFrame(tick);
    return function stop() {
      stopped = true;
      window.cancelAnimationFrame(raf);
    };
  }

  /* ---------- misc ---------- */
  function announce(message) {
    var live = document.getElementById("toast");
    if (!live) return;
    live.textContent = message;
    live.classList.add("show");
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(function () {
      live.classList.remove("show");
    }, 2000);
  }

  return {
    getBest: getBest,
    setBest: setBest,
    formatTime: formatTime,
    el: el,
    canvas: canvas,
    point: point,
    roundedRect: roundedRect,
    overlay: overlay,
    keys: keys,
    swipe: swipe,
    loop: loop,
    clamp: clamp,
    randInt: randInt,
    isTyping: isTyping,
    announce: announce
  };
})();

/* ------------------------------------------------------------
   Arcade registry. Each game file calls Arcade.register().
   ------------------------------------------------------------ */
window.Arcade = (function () {
  "use strict";
  var games = {};
  return {
    register: function (definition) {
      if (!definition || !definition.id || typeof definition.mount !== "function") {
        throw new Error("Arcade.register needs an id and a mount()");
      }
      games[definition.id] = definition;
    },
    get: function (id) {
      return Object.prototype.hasOwnProperty.call(games, id) ? games[id] : null;
    },
    ids: function () {
      return Object.keys(games);
    }
  };
})();
