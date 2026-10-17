/* Brick Breaker — mouse / touch paddle, space to serve. */
(function () {
  "use strict";

  var W = 800;
  var H = 520;
  var COLS = 9;
  var ROWS = 5;
  var BRICK_W = 74;
  var BRICK_H = 22;
  var GAP = 8;
  var TOP = 86;
  var LEFT = 35;
  var ROW_COLORS = ["#7ce7ff", "#5b8cff", "#a78bfa", "#ff8ad4", "#ffd76a"];

  Arcade.register({
    id: "breakout",
    mount: function (root) {
      var g = GameKit.canvas(root, W, H);
      var ctx = g.ctx;
      var overlay = GameKit.overlay(root);
      var stopLoop = function () {};
      var offKeys = function () {};

      if (!ctx) return { destroy: function () { overlay.el.remove(); } };

      var paddle;
      var ball;
      var bricks;
      var score;
      var best;
      var lives;
      var level;
      var running;
      var finished;
      var leftHeld;
      var rightHeld;

      best = GameKit.getBest("breakout") || 0;

      function buildBricks() {
        bricks = [];
        for (var row = 0; row < ROWS; row++) {
          for (var col = 0; col < COLS; col++) {
            bricks.push({
              x: LEFT + col * (BRICK_W + GAP),
              y: TOP + row * (BRICK_H + GAP),
              w: BRICK_W,
              h: BRICK_H,
              color: ROW_COLORS[row % ROW_COLORS.length],
              alive: true,
              points: (ROWS - row) * 10
            });
          }
        }
      }

      function resetPaddle() {
        paddle = { w: 112, h: 14, x: W / 2 - 56, y: H - 34, speed: 640 };
      }

      function baseSpeed() {
        return 400 + (level - 1) * 34;
      }

      function resetBall(stuck) {
        ball = {
          x: paddle.x + paddle.w / 2,
          y: paddle.y - 10,
          r: 8,
          vx: 0,
          vy: 0,
          speed: baseSpeed(),
          stuck: stuck !== false,
          trail: []
        };
        if (!ball.stuck) {
          var angle = (Math.random() * 0.9 - 0.45);
          ball.vx = Math.sin(angle) * ball.speed;
          ball.vy = -Math.cos(angle) * ball.speed;
        }
      }

      function reset(full) {
        if (full) {
          score = 0;
          lives = 3;
          level = 1;
        }
        finished = false;
        running = true;
        leftHeld = false;
        rightHeld = false;
        resetPaddle();
        buildBricks();
        resetBall(true);
      }

      function serve() {
        if (!ball || !ball.stuck || finished) return;
        var angle = (Math.random() * 0.8 - 0.4);
        ball.vx = Math.sin(angle) * ball.speed;
        ball.vy = -Math.cos(angle) * ball.speed;
        ball.stuck = false;
      }

      function gameOver() {
        finished = true;
        var record = GameKit.setBest("breakout", score, "high");
        if (record != null) best = record;
        draw();
        overlay.show({
          kicker: "Game over",
          title: "Score " + score,
          text: "Best " + best + " · Level " + level,
          action: "Play again",
          onAction: function () { reset(true); overlay.hide(); }
        });
      }

      function loseLife() {
        lives -= 1;
        if (lives <= 0) {
          gameOver();
          return;
        }
        resetBall(true);
      }

      function levelCleared() {
        score += 50;
        level += 1;
        resetBall(true);
        buildBricks();
      }

      function movePaddle(dt) {
        var dx = 0;
        if (leftHeld) dx -= 1;
        if (rightHeld) dx += 1;
        if (dx) paddle.x += dx * paddle.speed * dt;
        paddle.x = GameKit.clamp(paddle.x, 8, W - paddle.w - 8);
        if (ball.stuck) {
          ball.x = paddle.x + paddle.w / 2;
          ball.y = paddle.y - 10;
        }
      }

      function brickHit(bx, by, prevY) {
        for (var i = 0; i < bricks.length; i++) {
          var b = bricks[i];
          if (!b.alive) continue;
          if (bx + ball.r < b.x || bx - ball.r > b.x + b.w) continue;
          if (by + ball.r < b.y || by - ball.r > b.y + b.h) continue;

          b.alive = false;
          score += b.points;

          var wasAbove = prevY + ball.r <= b.y + 2;
          var wasBelow = prevY - ball.r >= b.y + b.h - 2;
          if (wasAbove || wasBelow) ball.vy = -ball.vy;
          else ball.vx = -ball.vx;

          if (bricks.every(function (item) { return !item.alive; })) levelCleared();
          return;
        }
      }

      function stepBall(stepDt) {
        var prevY = ball.y;
        ball.x += ball.vx * stepDt;
        ball.y += ball.vy * stepDt;

        if (ball.x - ball.r <= 0) {
          ball.x = ball.r;
          ball.vx = Math.abs(ball.vx);
        } else if (ball.x + ball.r >= W) {
          ball.x = W - ball.r;
          ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y - ball.r <= 56) {
          ball.y = 56 + ball.r;
          ball.vy = Math.abs(ball.vy);
        }

        brickHit(ball.x, ball.y, prevY);

        if (ball.vy > 0 &&
            ball.y + ball.r >= paddle.y &&
            ball.y - ball.r <= paddle.y + paddle.h &&
            ball.x >= paddle.x - ball.r * 0.5 &&
            ball.x <= paddle.x + paddle.w + ball.r * 0.5) {
          var offset = GameKit.clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
          var angle = offset * 1.05;
          ball.speed = Math.min(ball.speed + 7, 760);
          ball.vx = Math.sin(angle) * ball.speed;
          ball.vy = -Math.cos(angle) * ball.speed;
          ball.y = paddle.y - ball.r - 1;
          ball.trail.length = 0;
        }

        if (ball.y - ball.r > H + 20) loseLife();

        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 8) ball.trail.shift();
      }

      function update(dt) {
        movePaddle(dt);
        if (!ball.stuck && !finished) {
          var steps = Math.max(1, Math.ceil((ball.speed * dt) / 6));
          var stepDt = dt / steps;
          for (var i = 0; i < steps && !ball.stuck && !finished; i++) stepBall(stepDt);
        }
      }

      function drawBackground() {
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#0a1028");
        bg.addColorStop(0.65, "#080c1c");
        bg.addColorStop(1, "#05070f");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "rgba(124, 231, 255, 0.08)";
        for (var i = 0; i < 26; i++) {
          var x = (i * 137) % W;
          var y = (i * 83) % 300;
          ctx.beginPath();
          ctx.arc(x, y, i % 3 === 0 ? 1.6 : 1, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 56);
        ctx.lineTo(W, 56);
        ctx.stroke();
      }

      function drawBricks() {
        for (var i = 0; i < bricks.length; i++) {
          var b = bricks[i];
          if (!b.alive) continue;
          ctx.save();
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 10;
          ctx.fillStyle = b.color;
          GameKit.roundedRect(ctx, b.x, b.y, b.w, b.h, 5);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = "rgba(8, 12, 28, 0.34)";
          GameKit.roundedRect(ctx, b.x + 3, b.y + 3, b.w - 6, b.h - 7, 3);
          ctx.fill();
        }
      }

      function drawPaddle() {
        ctx.save();
        ctx.shadowColor = "rgba(124, 231, 255, 0.7)";
        ctx.shadowBlur = 18;
        var grad = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
        grad.addColorStop(0, "#57c7ff");
        grad.addColorStop(1, "#9d8cff");
        ctx.fillStyle = grad;
        GameKit.roundedRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 7);
        ctx.fill();
        ctx.restore();
      }

      function drawBall() {
        for (var i = 0; i < ball.trail.length; i++) {
          var t = ball.trail[i];
          ctx.fillStyle = "rgba(180, 240, 255, " + (0.03 + i * 0.015) + ")";
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.r * (0.4 + i * 0.06), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.shadowColor = "#bdf3ff";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#eafcff";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawPill(text, x, y, align, color) {
        ctx.font = '600 16px "Google Sans", Roboto, Arial, sans-serif';
        var w = ctx.measureText(text).width + 26;
        var left = align === "right" ? x - w : x;
        GameKit.roundedRect(ctx, left, y, w, 32, 16);
        ctx.fillStyle = "rgba(4, 10, 24, 0.66)";
        ctx.fill();
        ctx.fillStyle = color || "#cfe6ff";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(text, left + 13, y + 17);
      }

      function drawHint() {
        if (finished) return;
        if (ball.stuck) {
          ctx.font = '500 16px "Google Sans", Roboto, Arial, sans-serif';
          ctx.fillStyle = "rgba(207, 230, 255, 0.6)";
          ctx.textAlign = "center";
          ctx.fillText("Click or press Space to serve", W / 2, H - 62);
        }
      }

      function draw() {
        drawBackground();
        drawBricks();
        drawPaddle();
        drawBall();
        drawPill("SCORE " + score, 18, 13, "left");
        drawPill("LIVES " + lives, W / 2, 13, "left", "#ffc2c2");
        drawPill("LEVEL " + level, W - 18, 13, "right", "#c9b8ff");
        drawPill("BEST " + best, W - 18, 46, "right", "rgba(207,230,255,.6)");
        drawHint();
      }

      offKeys = GameKit.keys({
        prevent: ["ArrowLeft", "ArrowRight", " ", "a", "d"],
        down: function (event) {
          var k = event.key.toLowerCase();
          if (k === "arrowleft" || k === "a") leftHeld = true;
          else if (k === "arrowright" || k === "d") rightHeld = true;
          else if (k === " ") serve();
        },
        up: function (event) {
          var k = event.key.toLowerCase();
          if (k === "arrowleft" || k === "a") leftHeld = false;
          else if (k === "arrowright" || k === "d") rightHeld = false;
        }
      });

      function onPointerMove(event) {
        var p = GameKit.point(g.canvas, event, W, H);
        paddle.x = GameKit.clamp(p.x - paddle.w / 2, 8, W - paddle.w - 8);
        if (ball.stuck) {
          ball.x = paddle.x + paddle.w / 2;
          ball.y = paddle.y - 10;
        }
      }
      function onPointerDown(event) {
        onPointerMove(event);
        serve();
      }
      g.canvas.addEventListener("pointermove", onPointerMove);
      g.canvas.addEventListener("pointerdown", onPointerDown);

      reset(true);
      overlay.show({
        kicker: "Brick Breaker",
        title: "Clear the wall",
        text: "Move with the mouse, arrow keys or a finger. Click or press Space to serve. Three lives.",
        action: "Start",
        onAction: function () { overlay.hide(); serve(); }
      });
      draw();

      stopLoop = GameKit.loop(function (dt) {
        if (!running) return;
        update(dt);
        draw();
      });

      return {
        destroy: function () {
          stopLoop();
          offKeys();
          g.canvas.removeEventListener("pointermove", onPointerMove);
          g.canvas.removeEventListener("pointerdown", onPointerDown);
          overlay.el.remove();
        }
      };
    }
  });
})();
