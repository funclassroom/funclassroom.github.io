/* Sky Dash — one-button flier. */
(function () {
  "use strict";

  var W = 800;
  var H = 520;
  var PIPE_W = 68;
  var GAP = 168;
  var GROUND = H - 42;
  var GRAVITY = 1500;
  var FLAP = -410;

  Arcade.register({
    id: "sky-dash",
    mount: function (root) {
      var g = GameKit.canvas(root, W, H);
      var ctx = g.ctx;
      var overlay = GameKit.overlay(root);
      var stopLoop = function () {};
      var offKeys = function () {};

      if (!ctx) return { destroy: function () { overlay.el.remove(); } };

      var bird;
      var pipes;
      var clouds;
      var score;
      var best;
      var state;
      var time;
      var spawnGap;

      best = GameKit.getBest("sky-dash") || 0;

      function reset() {
        bird = { x: 176, y: H * 0.42, vy: 0, r: 17, rot: 0 };
        pipes = [];
        score = 0;
        time = 0;
        spawnGap = 300;
        state = "ready";
        clouds = [];
        for (var i = 0; i < 7; i++) {
          clouds.push({
            x: Math.random() * W,
            y: 40 + Math.random() * 220,
            s: 0.5 + Math.random() * 0.9,
            v: 10 + Math.random() * 20
          });
        }
        overlay.show({
          kicker: "Sky Dash",
          title: "Stay in the air",
          text: "Space, click or tap to flap. Thread the gaps. The pipes are not going to move for you.",
          action: "Start",
          onAction: begin
        });
      }

      function begin() {
        if (state === "dead") return;
        state = "playing";
        overlay.hide();
        if (bird.y > H * 0.5) bird.y = H * 0.5;
        flap();
      }

      function flap() {
        if (state !== "playing") return;
        bird.vy = FLAP;
        bird.rot = -0.42;
      }

      function die() {
        state = "dead";
        var record = GameKit.setBest("sky-dash", score, "high");
        if (record != null) best = record;
        draw();
        overlay.show({
          kicker: "Game over",
          title: score + (score === 1 ? " gap" : " gaps"),
          text: "Best " + best + ". Gravity remains undefeated.",
          action: "Try again",
          onAction: function () { reset(); begin(); }
        });
      }

      function spawnPipe() {
        var margin = 76;
        var gapY = GameKit.randInt(margin, GroundTop() - GAP - margin);
        pipes.push({ x: W + 80, gapY: gapY, passed: false });
      }

      function GroundTop() {
        return GROUND;
      }

      function pipeSpeed() {
        return Math.min(330, 205 + score * 4);
      }

      function update(dt) {
        time += dt;

        for (var c = 0; c < clouds.length; c++) {
          clouds[c].x -= clouds[c].v * dt;
          if (clouds[c].x < -120) clouds[c].x = W + 80;
        }

        if (state !== "playing") return;

        bird.vy += GRAVITY * dt;
        bird.y += bird.vy * dt;
        bird.rot = Math.min(1.1, bird.rot + (bird.vy / 1100));

        var moving = pipeSpeed();
        for (var i = 0; i < pipes.length; i++) pipes[i].x -= moving * dt;

        if (!pipes.length || pipes[pipes.length - 1].x < W - spawnGap) spawnPipe();
        while (pipes.length && pipes[0].x + PIPE_W < -40) pipes.shift();

        for (var j = 0; j < pipes.length; j++) {
          var p = pipes[j];
          if (!p.passed && p.x + PIPE_W < bird.x - bird.r) {
            p.passed = true;
            score += 1;
          }
          if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W) {
            if (bird.y - bird.r < p.gapY || bird.y + bird.r > p.gapY + GAP) {
              die();
              return;
            }
          }
        }

        if (bird.y + bird.r >= GROUND) {
          bird.y = GROUND - bird.r;
          die();
        }
        if (bird.y - bird.r < 0) {
          bird.y = bird.r;
          bird.vy = Math.max(bird.vy, 0);
        }
      }

      function drawSky() {
        var sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#0d2c5c");
        sky.addColorStop(0.42, "#3a7fd0");
        sky.addColorStop(0.78, "#8ec9ee");
        sky.addColorStop(1, "#ffd9a0");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#ffe9b0";
        ctx.beginPath();
        ctx.arc(W - 120, 96, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
        for (var i = 0; i < clouds.length; i++) {
          var c = clouds[i];
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 52 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
          ctx.ellipse(c.x + 30 * c.s, c.y + 4 * c.s, 34 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // distant hills
        ctx.fillStyle = "rgba(30, 78, 110, 0.35)";
        ctx.beginPath();
        ctx.moveTo(0, GROUND);
        for (var x = 0; x <= W; x += 80) {
          ctx.lineTo(x, GROUND - 44 - Math.sin((x + time * 8) / 150) * 26);
        }
        ctx.lineTo(W, GROUND);
        ctx.closePath();
        ctx.fill();
      }

      function drawPipes() {
        for (var i = 0; i < pipes.length; i++) {
          var p = pipes[i];
          var topH = p.gapY;
          var bottomY = p.gapY + GAP;

          var grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
          grad.addColorStop(0, "#1f9d55");
          grad.addColorStop(0.45, "#49d17f");
          grad.addColorStop(1, "#167244");

          ctx.fillStyle = grad;
          GameKit.roundedRect(ctx, p.x, -20, PIPE_W, topH + 20, 6);
          ctx.fill();
          GameKit.roundedRect(ctx, p.x, bottomY, PIPE_W, GROUND - bottomY, 6);
          ctx.fill();

          ctx.fillStyle = "#8cf0b6";
          ctx.fillRect(p.x + 10, 0, 6, Math.max(0, topH - 12));
          ctx.fillRect(p.x + 10, bottomY + 12, 6, Math.max(0, GROUND - bottomY - 20));

          ctx.fillStyle = "#0f5c37";
          GameKit.roundedRect(ctx, p.x - 6, topH - 20, PIPE_W + 12, 20, 5);
          ctx.fill();
          GameKit.roundedRect(ctx, p.x - 6, bottomY, PIPE_W + 12, 20, 5);
          ctx.fill();
        }
      }

      function drawGround() {
        var grad = ctx.createLinearGradient(0, GROUND, 0, H);
        grad.addColorStop(0, "#2f6b3c");
        grad.addColorStop(1, "#14341d");
        ctx.fillStyle = grad;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = "rgba(160, 245, 170, 0.25)";
        ctx.fillRect(0, GROUND, W, 3);
      }

      function drawBird() {
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.rot);

        ctx.fillStyle = "rgba(255, 214, 90, 0.22)";
        ctx.beginPath();
        ctx.arc(0, 0, bird.r + 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffd24a";
        ctx.beginPath();
        ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#f0a91d";
        ctx.beginPath();
        ctx.ellipse(-5, 4, 10, 6, -0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff8dc";
        ctx.beginPath();
        ctx.arc(6, -5, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#16233b";
        ctx.beginPath();
        ctx.arc(7.5, -5, 2.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ff8a3d";
        ctx.beginPath();
        ctx.moveTo(13, -1);
        ctx.lineTo(23, 4);
        ctx.lineTo(13, 8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      function drawPill(text, x, y, align) {
        ctx.font = '600 16px "Google Sans", Roboto, Arial, sans-serif';
        var w = ctx.measureText(text).width + 26;
        var left = align === "right" ? x - w : x;
        GameKit.roundedRect(ctx, left, y, w, 32, 16);
        ctx.fillStyle = "rgba(8, 20, 34, 0.4)";
        ctx.fill();
        ctx.fillStyle = "#f4fbff";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(text, left + 13, y + 17);
      }

      function draw() {
        drawSky();
        drawPipes();
        drawGround();
        drawBird();

        var big = String(score);
        ctx.font = '700 52px "Google Sans", Roboto, Arial, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(8, 24, 40, 0.35)";
        ctx.fillText(big, W / 2 + 2, 18 + 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(big, W / 2, 18);

        drawPill("BEST " + best, W - 18, 18, "right");
      }

      function onPointer(event) {
        event.preventDefault();
        if (state === "playing") flap();
        else if (state === "ready") begin();
        else if (state === "dead") { reset(); begin(); }
      }

      offKeys = GameKit.keys({
        prevent: [" ", "ArrowUp"],
        down: function (event) {
          if (event.key === " " || event.key === "ArrowUp") {
            if (state === "ready") begin();
            else if (state === "dead") { reset(); begin(); }
            else flap();
          }
        }
      });
      g.canvas.addEventListener("pointerdown", onPointer);

      reset();
      draw();

      stopLoop = GameKit.loop(function (dt) {
        update(dt);
        draw();
      });

      return {
        destroy: function () {
          stopLoop();
          offKeys();
          g.canvas.removeEventListener("pointerdown", onPointer);
          overlay.el.remove();
        }
      };
    }
  });
})();
