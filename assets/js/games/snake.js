/* Snake — 24 × 24 grid, classic rules, keyboard + swipe. */
(function () {
  "use strict";

  var COLS = 24;
  var ROWS = 24;
  var CELL = 25;
  var W = COLS * CELL;
  var H = ROWS * CELL;

  Arcade.register({
    id: "snake",
    mount: function (root) {
      var g = GameKit.canvas(root, W, H);
      var ctx = g.ctx;
      var overlay = GameKit.overlay(root);
      var stopLoop = function () {};
      var offKeys = function () {};
      var offSwipe = function () {};

      if (!ctx) return { destroy: function () { overlay.el.remove(); } };

      var snake, dir, queue, food, score, best, dead, started, paused, acc, stepMs;

      best = GameKit.getBest("snake") || 0;

      function reset() {
        snake = [];
        for (var i = 0; i < 4; i++) snake.push({ x: 9 - i, y: 12 });
        dir = { x: 1, y: 0 };
        queue = [];
        score = 0;
        dead = false;
        started = false;
        paused = false;
        acc = 0;
        stepMs = 130;
        placeFood();
        overlay.show({
          kicker: "Snake",
          title: "Ready?",
          text: "Arrow keys, WASD or a swipe. Eat the apples and do not bite yourself.",
          action: "Start",
          onAction: begin
        });
      }

      function placeFood() {
        var open = [];
        for (var y = 0; y < ROWS; y++) {
          for (var x = 0; x < COLS; x++) {
            if (!snake.some(function (s) { return s.x === x && s.y === y; })) open.push({ x: x, y: y });
          }
        }
        food = open[GameKit.randInt(0, open.length - 1)] || { x: 0, y: 0 };
      }

      function begin() {
        if (dead) return;
        started = true;
        paused = false;
        overlay.hide();
      }

      function pause() {
        paused = true;
        overlay.show({
          kicker: "Snake",
          title: "Paused",
          text: "Take a breath. The apples are not going anywhere.",
          action: "Resume",
          onAction: begin
        });
      }

      function die() {
        dead = true;
        started = false;
        var record = GameKit.setBest("snake", score, "high");
        if (record != null) best = record;
        draw();
        overlay.show({
          kicker: "Game over",
          title: "Score " + score,
          text: "Best " + best + ". The wall was right there.",
          action: "Play again",
          onAction: function () { reset(); begin(); }
        });
      }

      function turn(nx, ny) {
        if (dead) return;
        if (!started) begin();
        var last = queue.length ? queue[queue.length - 1] : dir;
        if (nx === -last.x && ny === -last.y) return;
        if (nx === last.x && ny === last.y) return;
        if (queue.length < 3) queue.push({ x: nx, y: ny });
      }

      function step() {
        if (queue.length) dir = queue.shift();
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
          die();
          return;
        }

        var eating = head.x === food.x && head.y === food.y;
        var body = eating ? snake : snake.slice(0, -1);
        if (body.some(function (s) { return s.x === head.x && s.y === head.y; })) {
          die();
          return;
        }

        snake.unshift(head);
        if (eating) {
          score += 10;
          stepMs = Math.max(66, 130 - snake.length * 1.6);
          placeFood();
        } else {
          snake.pop();
        }
      }

      function drawBoard() {
        var bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, "#0a1712");
        bg.addColorStop(1, "#06100c");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "rgba(126, 240, 190, 0.05)";
        for (var y = 0; y < ROWS; y++) {
          for (var x = 0; x < COLS; x++) {
            if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
        }
      }

      function drawPill(text, x, y, align) {
        ctx.font = '600 17px "Google Sans", Roboto, Arial, sans-serif';
        var w = ctx.measureText(text).width + 28;
        var left = align === "right" ? x - w : x;
        GameKit.roundedRect(ctx, left, y, w, 36, 18);
        ctx.fillStyle = "rgba(4, 16, 11, 0.62)";
        ctx.fill();
        ctx.fillStyle = "#b9f5d6";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(text, left + 14, y + 19);
      }

      function drawApple(cx, cy) {
        ctx.save();
        ctx.shadowColor = "rgba(255, 90, 90, 0.55)";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#ff5a5a";
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#7fe08c";
        ctx.beginPath();
        ctx.ellipse(cx + 4, cy - CELL * 0.38, 5.5, 3, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      function draw() {
        drawBoard();

        var fx = food.x * CELL + CELL / 2;
        var fy = food.y * CELL + CELL / 2;
        drawApple(fx, fy);

        for (var i = snake.length - 1; i >= 0; i--) {
          var seg = snake[i];
          var t = i / Math.max(1, snake.length - 1);
          var px = seg.x * CELL;
          var py = seg.y * CELL;
          ctx.fillStyle = i === 0 ? "#a7ffcf" : "hsl(" + (152 - t * 18) + ", " + (72 - t * 20) + "%, " + (62 - t * 26) + "%)";
          GameKit.roundedRect(ctx, px + 1.5, py + 1.5, CELL - 3, CELL - 3, i === 0 ? 8 : 6);
          ctx.fill();
        }

        var head = snake[0];
        var hx = head.x * CELL + CELL / 2;
        var hy = head.y * CELL + CELL / 2;
        var ex = dir.y !== 0 ? 5 : 0;
        var ey = dir.x !== 0 ? 5 : 0;
        ctx.fillStyle = "#06331f";
        ctx.beginPath();
        ctx.arc(hx + dir.x * 3 + ex, hy + dir.y * 3 + ey, 2.1, 0, Math.PI * 2);
        ctx.arc(hx + dir.x * 3 - ex, hy + dir.y * 3 - ey, 2.1, 0, Math.PI * 2);
        ctx.fill();

        drawPill("SCORE " + score, 16, 14, "left");
        drawPill("BEST " + best, W - 16, 14, "right");
      }

      offKeys = GameKit.keys({
        prevent: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "],
        down: function (event) {
          var k = event.key.toLowerCase();
          if (k === "arrowup" || k === "w") turn(0, -1);
          else if (k === "arrowdown" || k === "s") turn(0, 1);
          else if (k === "arrowleft" || k === "a") turn(-1, 0);
          else if (k === "arrowright" || k === "d") turn(1, 0);
          else if (k === " ") {
            if (dead) { reset(); begin(); }
            else if (!started) begin();
            else paused ? begin() : pause();
          }
        }
      });

      offSwipe = GameKit.swipe(g.wrap, function (direction) {
        if (direction === "up") turn(0, -1);
        else if (direction === "down") turn(0, 1);
        else if (direction === "left") turn(-1, 0);
        else if (direction === "right") turn(1, 0);
      });

      stopLoop = GameKit.loop(function (dt) {
        if (started && !dead && !paused) {
          acc += dt * 1000;
          while (acc >= stepMs && !dead) {
            acc -= stepMs;
            step();
          }
        }
        draw();
      });

      reset();

      return {
        destroy: function () {
          stopLoop();
          offKeys();
          offSwipe();
          overlay.el.remove();
        }
      };
    }
  });
})();
