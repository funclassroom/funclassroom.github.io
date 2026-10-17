/* Paddle Duel — first to seven, mouse / touch / arrow keys. */
(function () {
  "use strict";

  var W = 800;
  var H = 500;
  var WIN_SCORE = 7;
  var PADDLE_W = 14;
  var PADDLE_H = 88;

  Arcade.register({
    id: "pong",
    mount: function (root) {
      var g = GameKit.canvas(root, W, H);
      var ctx = g.ctx;
      var overlay = GameKit.overlay(root);
      var stopLoop = function () {};
      var offKeys = function () {};

      if (!ctx) return { destroy: function () { overlay.el.remove(); } };

      var player;
      var ai;
      var ball;
      var playerScore;
      var aiScore;
      var rally;
      var bestRally;
      var state;
      var upHeld;
      var downHeld;
      var serveWait;
      var serveDir;
      var hitFlash;

      bestRally = GameKit.getBest("pong") || 0;

      function resetMatch() {
        player = { x: 32, y: H / 2 - PADDLE_H / 2, w: PADDLE_W, h: PADDLE_H, speed: 540, glow: 0 };
        ai = { x: W - 32 - PADDLE_W, y: H / 2 - PADDLE_H / 2, w: PADDLE_W, h: PADDLE_H, speed: 300, glow: 0 };
        playerScore = 0;
        aiScore = 0;
        rally = 0;
        hitFlash = 0;
        upHeld = false;
        downHeld = false;
        state = "ready";
        centreBall();
        serveWait = 0;
        serveDir = Math.random() < 0.5 ? -1 : 1;
      }

      function centreBall() {
        ball = { x: W / 2, y: H / 2, r: 9, vx: 0, vy: 0, trail: [] };
      }

      function speed() {
        return Math.min(620, 340 + rally * 12);
      }

      function launch(direction) {
        var angle = Math.random() * 0.7 - 0.35;
        ball.vx = Math.cos(angle) * speed() * direction;
        ball.vy = Math.sin(angle) * speed();
        ball.trail = [];
      }

      function begin() {
        state = "playing";
        overlay.hide();
        centreBall();
        serveWait = 0.6;
      }

      function point(who) {
        if (who === "player") playerScore += 1;
        else aiScore += 1;
        rally = 0;
        if (playerScore >= WIN_SCORE || aiScore >= WIN_SCORE) {
          finish();
          return;
        }
        centreBall();
        serveWait = 0.7;
        serveDir = who === "player" ? -1 : 1;
      }

      function finish() {
        state = "over";
        var record = GameKit.setBest("pong", bestRally, "high");
        if (record != null) bestRally = record;
        draw();
        var won = playerScore > aiScore;
        overlay.show({
          kicker: won ? "You win" : "Computer wins",
          title: playerScore + " — " + aiScore,
          text: "Best rally " + bestRally + " hits. " + (won ? "The machine wants a rematch." : "Try moving the paddle next time."),
          action: "Rematch",
          onAction: function () {
            resetMatch();
            begin();
          }
        });
      }

      function movePaddles(dt) {
        if (upHeld) player.y -= player.speed * dt;
        if (downHeld) player.y += player.speed * dt;
        player.y = GameKit.clamp(player.y, 8, H - player.h - 8);

        var target = ball.vx > 0 ? ball.y - ai.h / 2 : H / 2 - ai.h / 2;
        var maxSpeed = 270 + Math.min(110, rally * 14);
        var diff = target - ai.y;
        ai.y += GameKit.clamp(diff, -maxSpeed * dt, maxSpeed * dt);
        ai.y = GameKit.clamp(ai.y, 8, H - ai.h - 8);

        if (player.glow > 0) player.glow -= dt * 3;
        if (ai.glow > 0) ai.glow -= dt * 3;
        if (hitFlash > 0) hitFlash -= dt * 3;
      }

      function bounceOffPaddle(pad, leftSide) {
        if (ball.vx < 0 && !leftSide) return;
        if (ball.vx > 0 && leftSide) return;

        if (ball.y + ball.r < pad.y || ball.y - ball.r > pad.y + pad.h) return;

        var offset = GameKit.clamp((ball.y - (pad.y + pad.h / 2)) / (pad.h / 2), -1, 1);
        var angle = offset * 1.0;
        var nextSpeed = speed();
        ball.vx = Math.cos(angle) * nextSpeed * (leftSide ? 1 : -1);
        ball.vy = Math.sin(angle) * nextSpeed;
        ball.x = leftSide ? pad.x + pad.w + ball.r + 0.5 : pad.x - ball.r - 0.5;
        rally += 1;
        if (rally > bestRally) {
          bestRally = rally;
          GameKit.setBest("pong", bestRally, "high");
        }
        pad.glow = 1;
        hitFlash = 1;
        ball.trail = [];
      }

      function stepBall(dt) {
        awaitServe(dt);
        if (serveWait > 0) return;

        var steps = Math.max(1, Math.ceil((Math.abs(ball.vx) * dt) / 6));
        var stepDt = dt / steps;

        for (var i = 0; i < steps; i++) {
          ball.x += ball.vx * stepDt;
          ball.y += ball.vy * stepDt;

          if (ball.y - ball.r <= 8) {
            ball.y = 8 + ball.r;
            ball.vy = Math.abs(ball.vy);
          } else if (ball.y + ball.r >= H - 8) {
            ball.y = H - 8 - ball.r;
            ball.vy = -Math.abs(ball.vy);
          }

          if (ball.vx < 0 && ball.x - ball.r <= player.x + player.w && ball.x + ball.r >= player.x) {
            bounceOffPaddle(player, true);
          } else if (ball.vx > 0 && ball.x + ball.r >= ai.x && ball.x - ball.r <= ai.x + ai.w) {
            bounceOffPaddle(ai, false);
          }

          if (ball.x + ball.r < -10) {
            point("ai");
            return;
          }
          if (ball.x - ball.r > W + 10) {
            point("player");
            return;
          }
        }

        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 14) ball.trail.shift();
      }

      function awaitServe(dt) {
        if (serveWait <= 0) return;
        serveWait -= dt;
        if (serveWait <= 0) {
          centreBall();
          launch(serveDir);
        }
      }

      function drawBackground() {
        var bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, "#120a2c");
        bg.addColorStop(0.55, "#0d0a20");
        bg.addColorStop(1, "#070614");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = "rgba(200, 170, 255, 0.16)";
        ctx.lineWidth = 2;
        ctx.setLineDash([9, 14]);
        ctx.beginPath();
        ctx.moveTo(W / 2, 14);
        ctx.lineTo(W / 2, H - 14);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "rgba(200, 170, 255, 0.08)";
        ctx.strokeRect(8, 8, W - 16, H - 16);
      }

      function drawPaddle(pad, color) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 16 + Math.max(0, pad.glow) * 18;
        ctx.fillStyle = color;
        GameKit.roundedRect(ctx, pad.x, pad.y, pad.w, pad.h, 7);
        ctx.fill();
        ctx.restore();
      }

      function drawBall() {
        for (var i = 0; i < ball.trail.length; i++) {
          var t = ball.trail[i];
          ctx.fillStyle = "rgba(210, 190, 255, " + (0.02 + i * 0.02) + ")";
          ctx.beginPath();
          ctx.arc(t.x, t.y, ball.r * (0.4 + i * 0.05), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.shadowColor = "#e6dcff";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#f7f3ff";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawScore() {
        ctx.font = '700 54px "Google Sans", Roboto, Arial, sans-serif';
        ctx.textBaseline = "top";
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,255,255,.22)";
        ctx.fillText(String(playerScore), W / 2 - 34, 20);
        ctx.textAlign = "left";
        ctx.fillText(String(aiScore), W / 2 + 34, 20);

        ctx.font = '600 14px "Google Sans", Roboto, Arial, sans-serif';
        ctx.fillStyle = "rgba(210, 190, 255, 0.55)";
        ctx.textAlign = "center";
        ctx.fillText("FIRST TO " + WIN_SCORE, W / 2, 34);

        ctx.textAlign = "left";
        ctx.fillText("RALLY " + rally, 22, H - 32);
        ctx.textAlign = "right";
        ctx.fillText("BEST RALLY " + bestRally, W - 22, H - 32);
      }

      function draw() {
        drawBackground();
        drawPaddle(player, "#61e6ff");
        drawPaddle(ai, "#ff6bd6");
        drawBall();
        drawScore();
      }

      function onPointerMove(event) {
        var p = GameKit.point(g.canvas, event, W, H);
        player.y = GameKit.clamp(p.y - player.h / 2, 8, H - player.h - 8);
      }
      g.canvas.addEventListener("pointermove", onPointerMove);
      g.canvas.addEventListener("pointerdown", onPointerMove);

      offKeys = GameKit.keys({
        prevent: ["ArrowUp", "ArrowDown", "w", "s"],
        down: function (event) {
          var k = event.key.toLowerCase();
          if (k === "arrowup" || k === "w") upHeld = true;
          else if (k === "arrowdown" || k === "s") downHeld = true;
          else if (k === " " && state === "over") {
            resetMatch();
            begin();
          }
        },
        up: function (event) {
          var k = event.key.toLowerCase();
          if (k === "arrowup" || k === "w") upHeld = false;
          else if (k === "arrowdown" || k === "s") downHeld = false;
        }
      });

      stopLoop = GameKit.loop(function (dt) {
        if (state === "playing") {
          movePaddles(dt);
          stepBall(dt);
        }
        draw();
      });

      resetMatch();
      overlay.show({
        kicker: "Paddle Duel",
        title: "Beat the machine",
        text: "Move with the mouse, a finger, or ↑ / ↓. First to seven wins.",
        action: "Start",
        onAction: begin
      });
      draw();

      return {
        destroy: function () {
          stopLoop();
          offKeys();
          g.canvas.removeEventListener("pointermove", onPointerMove);
          g.canvas.removeEventListener("pointerdown", onPointerMove);
          overlay.el.remove();
        }
      };
    }
  });
})();
