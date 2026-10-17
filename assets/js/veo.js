/* Veo 3 AI Video — a tiny, fully offline "video dreamer".
   Type a scene, the page draws a short procedural clip from it.
   No network, no uploads, no real model: every frame is canvas geometry. */
(function () {
  "use strict";

  var canvas = document.getElementById("screen");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  var form = document.querySelector("[data-form]");
  var input = document.getElementById("prompt");
  var overlay = document.querySelector("[data-overlay]");
  var statusEl = document.querySelector("[data-status]");
  var bar = document.querySelector("[data-bar]");
  var generate = document.querySelector("[data-generate]");
  var chipsHost = document.querySelector("[data-chips]");

  var DURATION = 7; /* seconds of clip */
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  var W = 960;
  var H = 540;
  var clip = null;
  var raf = 0;
  var started = 0;
  var shownAt = 3.2;
  var busy = false;

  /* ---------- deterministic randomness ---------- */

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- scenes ---------- */

  var KINDS = [
    {
      key: "snow",
      words: ["yeti", "snow", "ice", "winter", "mountain", "ski", "arctic", "frost"],
      sky: ["#e8f4ff", "#8ec5ff"],
      accent: "#ffe08a",
      dust: "snow"
    },
    {
      key: "neon",
      words: ["neon", "city", "cyber", "night", "tokyo", "street", "rain", "synth"],
      sky: ["#0a0618", "#3b1168"],
      accent: "#ff3fa4",
      dust: "rain"
    },
    {
      key: "ocean",
      words: ["ocean", "sea", "underwater", "fish", "coral", "dive", "reef", "whale"],
      sky: ["#063a52", "#0b8a9e"],
      accent: "#8ff7e4",
      dust: "bubbles"
    },
    {
      key: "space",
      words: ["space", "moon", "planet", "astronaut", "galaxy", "star", "mars", "cosmic"],
      sky: ["#05060f", "#1b2350"],
      accent: "#ffd166",
      dust: "stars"
    },
    {
      key: "forest",
      words: ["forest", "jungle", "tree", "woods", "firefly", "leaf", "moss", "fern"],
      sky: ["#071c12", "#2f6b3f"],
      accent: "#c6ff8a",
      dust: "fireflies"
    },
    {
      key: "lava",
      words: ["lava", "volcano", "dragon", "fire", "magma", "inferno", "ember", "ash"],
      sky: ["#2a0a0a", "#a3320b"],
      accent: "#ffb347",
      dust: "embers"
    },
    {
      key: "sunset",
      words: [],
      sky: ["#ffd6a5", "#ff8fa3"],
      accent: "#fff1a8",
      dust: "dust"
    }
  ];

  function pickKind(prompt) {
    var text = prompt.toLowerCase();
    for (var i = 0; i < KINDS.length; i += 1) {
      for (var j = 0; j < KINDS[i].words.length; j += 1) {
        if (text.indexOf(KINDS[i].words[j]) !== -1) return KINDS[i];
      }
    }
    return KINDS[KINDS.length - 1];
  }

  function buildScene(prompt) {
    var kind = pickKind(prompt);
    var seed = hash(prompt || kind.key);
    var rand = rng(seed);
    var scene = { prompt: prompt, kind: kind, seed: seed };

    scene.peaks = [];
    for (var p = 0; p < 6; p += 1) {
      scene.peaks.push({ x: rand(), w: 0.12 + rand() * 0.16, h: 0.24 + rand() * 0.34 });
    }

    scene.buildings = [];
    for (var b = 0; b < 18; b += 1) {
      var w = 0.03 + rand() * 0.05;
      var lit = [];
      for (var l = 0; l < 12; l += 1) lit.push(rand() > 0.55);
      scene.buildings.push({ x: b / 18 + rand() * 0.02, w: w, h: 0.16 + rand() * 0.42, lit: lit });
    }

    scene.trees = [];
    for (var tr = 0; tr < 16; tr += 1) {
      scene.trees.push({ x: rand(), h: 0.2 + rand() * 0.3, w: 0.05 + rand() * 0.07 });
    }

    scene.stars = [];
    for (var st = 0; st < 90; st += 1) {
      scene.stars.push({ x: rand(), y: rand() * 0.7, r: 0.4 + rand() * 1.6, phase: rand() * 6.28 });
    }

    scene.dust = [];
    for (var d = 0; d < 70; d += 1) {
      scene.dust.push({
        x: rand(),
        y: rand(),
        size: 0.4 + rand() * 1.8,
        speed: 0.02 + rand() * 0.09,
        phase: rand() * 6.28
      });
    }

    scene.words = (prompt || "a yeti vlogging on a snowy mountain")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 14);
    return scene;
  }

  /* ---------- drawing helpers ---------- */

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function tri(x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }

  function tint(colour, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
  }

  /* ---------- the picture ---------- */

  function drawScene(scene, t) {
    var kind = scene.kind.key;
    ctx.clearRect(0, 0, W, H);

    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, scene.kind.sky[0]);
    sky.addColorStop(1, scene.kind.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (kind === "snow") drawSnow(scene, t);
    else if (kind === "neon") drawNeon(scene, t);
    else if (kind === "ocean") drawOcean(scene, t);
    else if (kind === "space") drawSpace(scene, t);
    else if (kind === "forest") drawForest(scene, t);
    else if (kind === "lava") drawLava(scene, t);
    else drawSunset(scene, t);

    drawHero(scene, t);
    drawDust(scene, t);
    drawFrameChrome(scene, t);
  }

  function drawSnow(scene, t) {
    var sun = ctx.createRadialGradient(W * 0.76, H * 0.2, 0, W * 0.76, H * 0.2, H * 0.22);
    sun.addColorStop(0, "rgba(255,255,255,0.95)");
    sun.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    scene.peaks.forEach(function (peak, i) {
      var depth = i / scene.peaks.length;
      var drift = (1 - depth) * t * 6;
      var base = H * (0.7 + depth * 0.06);
      var x = (((peak.x * W - drift) % (W * 1.4)) + W * 1.4) % (W * 1.4) - W * 0.2;
      var half = peak.w * W;
      var top = base - peak.h * H;
      ctx.fillStyle = ["#a9c6e6", "#8fb0d6", "#7697c2", "#5d7fab"][i % 4];
      tri(x - half, base, x, top, x + half, base);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      tri(x - half * 0.34, top + peak.h * H * 0.26, x, top, x + half * 0.34, top + peak.h * H * 0.26);
    });

    ctx.fillStyle = "#f7fbff";
    ctx.fillRect(0, H * 0.82, W, H * 0.18);
    ctx.fillStyle = "rgba(180,205,235,0.55)";
    ctx.fillRect(0, H * 0.82, W, H * 0.012);
  }

  function drawNeon(scene, t) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.18, H * 0.045, 0, 6.3);
    ctx.fill();

    scene.buildings.forEach(function (b, i) {
      var drift = t * (i % 2 ? 14 : 6);
      var x = (((b.x * W - drift) % (W + 120)) + W + 120) % (W + 120) - 60;
      var w = b.w * W;
      var h = b.h * H;
      ctx.fillStyle = i % 2 ? "#0d0a1c" : "#120d26";
      ctx.fillRect(x, H * 0.82 - h, w, h);
      ctx.fillStyle = i % 2 ? "rgba(255,63,164,0.75)" : "rgba(111,242,217,0.72)";
      for (var row = 0; row < 8; row += 1) {
        for (var col = 0; col < 3; col += 1) {
          if (!b.lit[row * 3 + col]) continue;
          var flick = 0.55 + 0.45 * Math.sin(t * 2 + row + col + i);
          ctx.globalAlpha = flick;
          ctx.fillRect(x + 6 + col * (w - 12) / 3, H * 0.82 - h + 10 + row * (h - 16) / 8, (w - 14) / 3, 4);
        }
      }
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = "#07050f";
    ctx.fillRect(0, H * 0.82, W, H * 0.18);

    var glow = ctx.createLinearGradient(0, H * 0.82, 0, H);
    glow.addColorStop(0, "rgba(255,63,164,0.55)");
    glow.addColorStop(1, "rgba(255,63,164,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, H * 0.82, W, H * 0.18);
  }

  function drawOcean(scene, t) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#d7fbff";
    for (var ray = 0; ray < 5; ray += 1) {
      var x = W * (0.15 + ray * 0.19) + Math.sin(t * 0.4 + ray) * 24;
      tri(x, -H * 0.1, x + W * 0.09, -H * 0.1, x + W * 0.24, H);
    }
    ctx.restore();

    ctx.fillStyle = "#083347";
    for (var band = 0; band < 3; band += 1) {
      ctx.beginPath();
      ctx.moveTo(0, H * (0.78 + band * 0.05));
      for (var xw = 0; xw <= W; xw += 16) {
        var y = H * (0.78 + band * 0.05) + Math.sin(xw / 70 + t * (1 + band * 0.3)) * 8;
        ctx.lineTo(xw, y);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = ["#0a4157", "#083347", "#062a3a"][band];
      ctx.fill();
    }

    ctx.fillStyle = "rgba(143,247,228,0.35)";
    for (var weed = 0; weed < 7; weed += 1) {
      var wx = W * (0.06 + weed * 0.14);
      ctx.beginPath();
      ctx.moveTo(wx, H);
      ctx.quadraticCurveTo(wx + Math.sin(t * 1.4 + weed) * 22, H * 0.86, wx + Math.sin(t + weed) * 12, H * 0.74);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(143,247,228,0.28)";
      ctx.stroke();
    }
  }

  function drawSpace(scene, t) {
    scene.stars.forEach(function (star) {
      var twinkle = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + star.phase));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x * W, star.y * H, star.r, 0, 6.3);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    var px = W * 0.78;
    var py = H * 0.32;
    var pr = H * 0.2;
    var planet = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
    planet.addColorStop(0, "#ffd9a0");
    planet.addColorStop(0.55, "#e08b5a");
    planet.addColorStop(1, "#7b3f47");
    ctx.fillStyle = planet;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, 6.3);
    ctx.fill();

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.strokeStyle = "rgba(255,226,180,0.6)";
    ctx.lineWidth = Math.max(2, H * 0.008);
    ctx.beginPath();
    ctx.ellipse(0, 0, pr * 1.55, pr * 0.42, 0, 0, 6.3);
    ctx.stroke();
    ctx.restore();

    if ((t % 4.2) < 0.5) {
      var sx = W * (0.1 + (t % 4.2) * 0.3);
      var sy = H * (0.12 + (t % 4.2) * 0.05);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - W * 0.09, sy + H * 0.045);
      ctx.stroke();
    }
  }

  function drawForest(scene, t) {
    var glow = ctx.createRadialGradient(W * 0.3, H * 0.7, 0, W * 0.3, H * 0.7, H * 0.5);
    glow.addColorStop(0, "rgba(198,255,138,0.22)");
    glow.addColorStop(1, "rgba(198,255,138,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    scene.trees.forEach(function (tree, i) {
      var depth = i % 3;
      var drift = t * (3 + depth * 5);
      var x = (((tree.x * W - drift) % (W + 100)) + W + 100) % (W + 100) - 50;
      var base = H * (0.84 + depth * 0.02);
      var h = tree.h * H * (0.8 + depth * 0.12);
      var w = tree.w * W;
      ctx.fillStyle = ["#04120b", "#082116", "#0d2f1f"][depth];
      tri(x - w, base, x, base - h, x + w, base);
      ctx.fillRect(x - w * 0.08, base - h * 0.12, w * 0.16, h * 0.12);
    });

    ctx.fillStyle = "#04120b";
    ctx.fillRect(0, H * 0.9, W, H * 0.1);
  }

  function drawLava(scene, t) {
    var glow = ctx.createLinearGradient(0, H * 0.4, 0, H);
    glow.addColorStop(0, "rgba(255,122,24,0)");
    glow.addColorStop(1, "rgba(255,122,24,0.38)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, H * 0.4, W, H * 0.6);

    ctx.fillStyle = "#1a0806";
    tri(W * 0.1, H * 0.84, W * 0.46, H * 0.3, W * 0.82, H * 0.84);

    ctx.fillStyle = "rgba(255,122,24,0.85)";
    ctx.beginPath();
    ctx.moveTo(W * 0.43, H * 0.33);
    ctx.quadraticCurveTo(W * 0.5, H * 0.48, W * 0.46, H * 0.62);
    ctx.quadraticCurveTo(W * 0.44, H * 0.48, W * 0.4, H * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#120503";
    ctx.fillRect(0, H * 0.84, W, H * 0.16);

    var pool = ctx.createRadialGradient(W * 0.46, H * 0.86, 0, W * 0.46, H * 0.86, W * 0.3);
    pool.addColorStop(0, "rgba(255,140,40,0.8)");
    pool.addColorStop(1, "rgba(255,140,40,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
  }

  function drawSunset(scene, t) {
    var sunY = H * (0.52 - Math.min(0.1, t * 0.012));
    var sun = ctx.createRadialGradient(W * 0.62, sunY, 0, W * 0.62, sunY, H * 0.3);
    sun.addColorStop(0, "rgba(255,241,168,1)");
    sun.addColorStop(0.35, "rgba(255,200,120,0.85)");
    sun.addColorStop(1, "rgba(255,160,120,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#7a4a6a";
    ctx.beginPath();
    ctx.ellipse(W * 0.22, H * 0.86, W * 0.4, H * 0.2, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = "#5b3a5e";
    ctx.beginPath();
    ctx.ellipse(W * 0.74, H * 0.9, W * 0.46, H * 0.22, 0, 0, 6.3);
    ctx.fill();

    ctx.strokeStyle = "rgba(60,30,50,0.7)";
    ctx.lineWidth = 2;
    for (var bird = 0; bird < 3; bird += 1) {
      var bx = W * (0.3 + bird * 0.08) + t * 8;
      var by = H * (0.22 + bird * 0.03) + Math.sin(t + bird) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 8, by);
      ctx.quadraticCurveTo(bx, by - 6, bx + 8, by);
      ctx.stroke();
    }
  }

  function drawHero(scene, t) {
    var kind = scene.kind.key;
    var bob = Math.sin(t * 2.1) * H * 0.012;
    var x = W * 0.26;
    var y = H * 0.74 + bob;
    var r = H * 0.085;

    ctx.save();
    ctx.translate(x, y);

    if (kind === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRect(-r * 1.2, -r * 1.6, r * 2.4, r * 2.9, r);
      ctx.fill();
      ctx.fillStyle = "#3d6fa8";
      roundRect(-r * 1.25, -r * 0.35, r * 2.5, r * 0.34, 5);
      ctx.fill();
      ctx.fillStyle = "#e8402a";
      ctx.fillRect(-r * 0.25, -r * 0.35, r * 0.5, r * 0.95);
      ctx.fillStyle = "#22303f";
      ctx.beginPath();
      ctx.arc(-r * 0.34, -r * 0.92, r * 0.09, 0, 6.3);
      ctx.arc(r * 0.34, -r * 0.92, r * 0.09, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = "#22303f";
      ctx.lineWidth = Math.max(1.5, r * 0.05);
      ctx.beginPath();
      ctx.arc(0, -r * 0.74, r * 0.22, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (kind === "neon") {
      ctx.fillStyle = "#1d1a33";
      roundRect(-r, -r * 1.5, r * 2, r * 2.5, r * 0.5);
      ctx.fill();
      ctx.fillStyle = "#6ff2d9";
      roundRect(-r * 0.75, -r * 1.15, r * 1.5, r * 0.62, r * 0.28);
      ctx.fill();
      ctx.fillStyle = "#ff3fa4";
      ctx.fillRect(-r * 0.5, -r * 0.2, r, r * 0.1);
    } else if (kind === "ocean") {
      ctx.fillStyle = "#ffd9a0";
      ctx.beginPath();
      ctx.arc(0, -r * 0.7, r * 0.85, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = "#0a4157";
      ctx.fillRect(-r * 0.6, -r * 0.85, r * 1.2, r * 0.4);
      ctx.fillStyle = "#ff7847";
      roundRect(-r * 0.9, -r * 0.15, r * 1.8, r * 1.2, r * 0.4);
      ctx.fill();
    } else if (kind === "space") {
      ctx.fillStyle = "#e7ecf7";
      ctx.beginPath();
      ctx.arc(0, -r * 0.75, r * 0.8, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = "#7fc7ff";
      ctx.beginPath();
      ctx.arc(0, -r * 0.75, r * 0.55, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = "#d9e2f2";
      roundRect(-r * 0.85, -r * 0.15, r * 1.7, r * 1.25, r * 0.4);
      ctx.fill();
    } else if (kind === "forest") {
      ctx.fillStyle = "#f0d8b8";
      ctx.beginPath();
      ctx.arc(0, -r * 0.7, r * 0.62, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = "#2f6b3f";
      roundRect(-r * 0.8, -r * 0.15, r * 1.6, r * 1.2, r * 0.35);
      ctx.fill();
      ctx.fillStyle = "#c6ff8a";
      ctx.beginPath();
      ctx.arc(0, -r * 0.7, r * 0.22, 0, 6.3);
      ctx.fill();
    } else if (kind === "lava") {
      ctx.fillStyle = "#2c0f0c";
      roundRect(-r, -r * 1.3, r * 2, r * 2.4, r * 0.6);
      ctx.fill();
      ctx.fillStyle = "#ffb347";
      ctx.beginPath();
      ctx.arc(-r * 0.38, -r * 0.5, r * 0.16, 0, 6.3);
      ctx.arc(r * 0.38, -r * 0.5, r * 0.16, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = "#ff7a18";
      tri(-r * 0.55, -r * 1.25, -r * 0.2, -r * 1.85, r * 0.05, -r * 1.25);
      tri(r * 0.55, -r * 1.25, r * 0.2, -r * 1.85, -r * 0.05, -r * 1.25);
    } else {
      ctx.fillStyle = "rgba(50,20,40,0.92)";
      ctx.beginPath();
      ctx.arc(0, -r * 0.85, r * 0.55, 0, 6.3);
      ctx.fill();
      roundRect(-r * 0.7, -r * 0.3, r * 1.4, r * 1.4, r * 0.5);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawDust(scene, t) {
    var kind = scene.kind.dust;
    scene.dust.forEach(function (p) {
      var x = p.x * W + Math.sin(t * 0.8 + p.phase) * 10;
      var y;
      if (kind === "snow") y = ((p.y + t * p.speed * 0.5) % 1) * H;
      else if (kind === "rain") {
        y = ((p.y + t * p.speed * 2.2) % 1) * H;
        ctx.strokeStyle = "rgba(180,200,255,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 14);
        ctx.stroke();
        return;
      } else if (kind === "bubbles") y = (1 - ((p.y + t * p.speed * 0.6) % 1)) * H;
      else if (kind === "embers") y = (1 - ((p.y + t * p.speed * 0.9) % 1)) * H;
      else y = ((p.y + t * p.speed * 0.2) % 1) * H;

      var alpha = 0.35 + 0.55 * Math.abs(Math.sin(t + p.phase));
      ctx.globalAlpha = alpha;
      if (kind === "stars") ctx.fillStyle = "#ffffff";
      else if (kind === "snow") ctx.fillStyle = "#ffffff";
      else if (kind === "bubbles") ctx.fillStyle = "#c8fbf1";
      else if (kind === "fireflies") ctx.fillStyle = "#d9ff8a";
      else if (kind === "embers") ctx.fillStyle = "#ffb347";
      else ctx.fillStyle = "rgba(255,241,168,0.9)";

      ctx.beginPath();
      ctx.arc(x, y, kind === "bubbles" ? p.size * 2 : p.size, 0, 6.3);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawFrameChrome(scene, t) {
    var fadeIn = Math.min(1, t / 0.5);
    var fadeOut = Math.min(1, Math.max(0, (DURATION - t) / 0.5));
    var fade = Math.min(fadeIn, fadeOut);

    var vignette = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, H * 0.95);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0, 0, W, H * 0.055);
    ctx.fillRect(0, H * 0.945, W, H * 0.055);

    // The prompt types itself out across the clip, so it always reads as a
    // sentence instead of being chopped into odd fragments.
    var words = scene.words;
    var reveal = Math.min(words.length, 1 + Math.floor((t / DURATION) * words.length * 1.12));
    var caption = words.slice(0, reveal).join(" ");
    var size = Math.max(14, Math.round(H * 0.044));
    ctx.font = "600 " + size + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(255,255,255," + (0.94 * fade).toFixed(3) + ")";

    var lines = [];
    var line = "";
    caption.split(" ").forEach(function (word) {
      var next = line ? line + " " + word : word;
      if (line && ctx.measureText(next).width > W * 0.8 && lines.length < 1) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, 2).forEach(function (text, index) {
      var y = H * 0.855 + (index - (lines.length - 1) / 2) * size * 1.3;
      ctx.fillText(text, W / 2, y);
    });
    ctx.shadowBlur = 0;

    ctx.font = "500 " + Math.max(10, Math.round(H * 0.02)) + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255," + (0.5 * fade).toFixed(3) + ")";
    ctx.fillText("Veo 3 · offline studio", W - W * 0.03, H * 0.075);
    ctx.textAlign = "left";
  }

  /* ---------- sizing ---------- */

  function measure() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(320, Math.round(rect.width || 960));
    H = Math.max(180, Math.round(rect.height || (W * 9) / 16));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- playback ---------- */

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function play(scene) {
    stop();
    clip = scene;
    measure();
    busy = true;
    generate.disabled = true;
    overlay.hidden = false;
    overlay.classList.remove("is-leaving");
    overlay.style.opacity = "";

    if (reduceMotion) {
      shownAt = 3.4;
      drawScene(scene, shownAt);
      finish("Still frame — motion is reduced on this device.");
      return;
    }

    started = performance.now();
    overlay.classList.add("is-leaving");
    window.setTimeout(function () { overlay.hidden = true; }, 380);
    raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    var t = (now - started) / 1000;
    if (t >= DURATION) {
      shownAt = DURATION - 0.05;
      drawScene(clip, shownAt);
      finish("Clip done. Describe another scene.");
      return;
    }
    shownAt = t;
    drawScene(clip, t);
    raf = requestAnimationFrame(loop);
  }

  function finish(message) {
    stop();
    busy = false;
    generate.disabled = false;
    overlay.hidden = true;
    overlay.classList.remove("is-leaving");
    overlay.style.opacity = "";
    statusEl.textContent = message;
  }

  /* ---------- the fake pipeline ---------- */

  var STEPS = [
    { at: 0.08, label: "Reading the prompt…" },
    { at: 0.34, label: "Dreaming 96 frames…" },
    { at: 0.64, label: "Weaving light and weather…" },
    { at: 0.88, label: "Rendering the cut…" }
  ];

  function generateClip() {
    if (busy) return;
    var prompt = (input.value || "").trim();
    if (!prompt) {
      prompt = input.placeholder;
      input.value = prompt;
    }

    var scene = buildScene(prompt);
    busy = true;
    generate.disabled = true;
    overlay.hidden = false;
    overlay.classList.remove("is-leaving");
    overlay.style.opacity = "";
    bar.style.width = "0%";
    statusEl.textContent = STEPS[0].label;

    var step = 0;
    var timer = window.setInterval(function () {
      step += 1;
      if (step >= STEPS.length) {
        window.clearInterval(timer);
        play(scene);
        return;
      }
      statusEl.textContent = STEPS[step].label;
      bar.style.width = Math.round(STEPS[step].at * 100) + "%";
    }, reduceMotion ? 220 : 560);

    bar.style.width = Math.round(STEPS[0].at * 100) + "%";
  }

  /* ---------- wiring ---------- */

  var IDEAS = [
    "a yeti vlogging on a snowy mountain",
    "neon Tokyo street in the rain",
    "an astronaut floating past a ringed planet",
    "a dragon circling a lava volcano",
    "fireflies in a mossy forest at night",
    "a whale gliding through a coral reef"
  ];

  IDEAS.forEach(function (idea) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "studio-chip";
    button.textContent = idea;
    button.addEventListener("click", function () {
      input.value = idea;
      generateClip();
    });
    chipsHost.appendChild(button);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    generateClip();
  });

  window.addEventListener("resize", function () {
    if (!clip) return;
    measure();
    if (!raf) drawScene(clip, shownAt);
  });

  measure();
  clip = buildScene(input.placeholder);
  drawScene(clip, 3.2);
}());
