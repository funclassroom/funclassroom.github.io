/* 2048 — DOM tiles, arrow keys / WASD / swipe. */
(function () {
  "use strict";

  var COLORS = {
    2:    { bg: "#eee4da", fg: "#776e65" },
    4:    { bg: "#ede0c8", fg: "#776e65" },
    8:    { bg: "#f2b179", fg: "#fff8ef" },
    16:   { bg: "#f59563", fg: "#fff8ef" },
    32:   { bg: "#f67c5f", fg: "#fff8ef" },
    64:   { bg: "#f65e3b", fg: "#fff8ef" },
    128:  { bg: "#edcf72", fg: "#fff8ef" },
    256:  { bg: "#edcc61", fg: "#fff8ef" },
    512:  { bg: "#edc850", fg: "#fff8ef" },
    1024: { bg: "#edc53f", fg: "#fff8ef" },
    2048: { bg: "#edc22e", fg: "#fff8ef" }
  };

  function face(value) {
    return COLORS[value] || { bg: "#3c3a32", fg: "#fff8ef" };
  }

  function size(value) {
    if (value < 100) return "clamp(22px, 7vmin, 36px)";
    if (value < 1000) return "clamp(18px, 5.6vmin, 30px)";
    if (value < 10000) return "clamp(15px, 4.6vmin, 25px)";
    return "clamp(12px, 3.8vmin, 21px)";
  }

  Arcade.register({
    id: "2048",
    mount: function (root) {
      var overlay = GameKit.overlay(root);
      var offKeys = function () {};
      var offSwipe = function () {};

      var grid = new Array(16).fill(0);
      var score = 0;
      var best = GameKit.getBest("2048") || 0;
      var won = false;
      var playing = false;
      var over = false;

      var wrap = GameKit.el("div", "g2048");
      wrap.innerHTML =
        '<div class="g2048-top">' +
          '<div class="g2048-brand"><h2>2048</h2><p>Join the tiles. Reach 2048.</p></div>' +
          '<div class="g2048-scores">' +
            '<div class="g2048-score"><span>Score</span><b data-score>0</b></div>' +
            '<div class="g2048-score"><span>Best</span><b data-best>0</b></div>' +
          '</div>' +
          '<button class="g2048-new" type="button" data-new>New game</button>' +
        '</div>' +
        '<div class="g2048-board" data-board></div>' +
        '<p class="g2048-hint">Arrow keys / WASD · swipe</p>';
      root.appendChild(wrap);

      var boardEl = wrap.querySelector("[data-board]");
      var scoreEl = wrap.querySelector("[data-score]");
      var bestEl = wrap.querySelector("[data-best]");
      var popCells = {};

      function render() {
        boardEl.innerHTML = "";
        for (var i = 0; i < 16; i++) {
          var cell = GameKit.el("div", "g2048-cell");
          var value = grid[i];
          if (value) {
            var tile = GameKit.el("div", "g2048-tile", String(value));
            var look = face(value);
            tile.style.background = look.bg;
            tile.style.color = look.fg;
            tile.style.fontSize = size(value);
            if (popCells[i]) tile.className += " pop";
            cell.appendChild(tile);
          }
          boardEl.appendChild(cell);
        }
        scoreEl.textContent = String(score);
        bestEl.textContent = String(Math.max(best, score));
        popCells = {};
      }

      function addTile() {
        var open = [];
        for (var i = 0; i < 16; i++) if (!grid[i]) open.push(i);
        if (!open.length) return;
        var index = open[GameKit.randInt(0, open.length - 1)];
        grid[index] = Math.random() < 0.9 ? 2 : 4;
        popCells[index] = true;
      }

      function lineFor(direction, index) {
        var line = [];
        for (var i = 0; i < 4; i++) {
          if (direction === "left") line.push(index * 4 + i);
          else if (direction === "right") line.push(index * 4 + (3 - i));
          else if (direction === "up") line.push(i * 4 + index);
          else line.push((3 - i) * 4 + index);
        }
        return line;
      }

      function move(direction) {
        if (!playing || over) return;
        var moved = false;
        var merged = {};

        for (var n = 0; n < 4; n++) {
          var line = lineFor(direction, n);
          var values = [];
          for (var i = 0; i < 4; i++) {
            var v = grid[line[i]];
            if (v) values.push(v);
          }

          var output = [];
          for (var k = 0; k < values.length; k++) {
            if (k + 1 < values.length && values[k] === values[k + 1]) {
              var sum = values[k] * 2;
              output.push(sum);
              score += sum;
              merged[line[output.length - 1]] = true;
              if (sum === 2048 && !won) won = true;
              k++;
            } else {
              output.push(values[k]);
            }
          }

          for (var j = 0; j < 4; j++) {
            var next = output[j] || 0;
            if (grid[line[j]] !== next) moved = true;
            grid[line[j]] = next;
          }
        }

        if (!moved) {
          if (!canMove()) finish();
          return;
        }

        popCells = merged;
        addTile();
        render();
        best = Math.max(best, score);
        GameKit.setBest("2048", score, "high");

        if (won && !over) {
          won = true;
          playing = false;
          overlay.show({
            kicker: "2048",
            title: "You made 2048",
            text: "Score " + score + ". Keep going for 4096 — nobody is stopping you.",
            action: "Keep going",
            onAction: function () { playing = true; overlay.hide(); }
          });
          return;
        }

        if (!canMove()) finish();
      }

      function canMove() {
        for (var i = 0; i < 16; i++) {
          if (!grid[i]) return true;
          var r = Math.floor(i / 4);
          var c = i % 4;
          if (c < 3 && grid[i] === grid[i + 1]) return true;
          if (r < 3 && grid[i] === grid[i + 4]) return true;
        }
        return false;
      }

      function finish() {
        over = true;
        playing = false;
        var record = GameKit.setBest("2048", score, "high");
        if (record != null) best = record;
        render();
        overlay.show({
          kicker: "No moves left",
          title: "Score " + score,
          text: "Best " + best + ". The board is full and the tiles have stopped being cooperative.",
          action: "Try again",
          onAction: function () { reset(); playing = true; overlay.hide(); }
        });
      }

      function reset() {
        grid = new Array(16).fill(0);
        score = 0;
        won = false;
        over = false;
        playing = true;
        best = GameKit.getBest("2048") || best;
        addTile();
        addTile();
        render();
      }

      function onKey(event) {
        var k = event.key.toLowerCase();
        if (k === "arrowleft" || k === "a") move("left");
        else if (k === "arrowright" || k === "d") move("right");
        else if (k === "arrowup" || k === "w") move("up");
        else if (k === "arrowdown" || k === "s") move("down");
      }

      offKeys = GameKit.keys({
        prevent: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s"],
        down: onKey
      });

      offSwipe = GameKit.swipe(wrap, function (direction) { move(direction); });

      wrap.querySelector("[data-new]").addEventListener("click", function () {
        reset();
        overlay.hide();
      });

      reset();
      playing = false;
      overlay.show({
        kicker: "2048",
        title: "Slide and merge",
        text: "Use the arrow keys, WASD or a swipe. Equal tiles merge. Reach 2048.",
        action: "Start",
        onAction: function () { playing = true; overlay.hide(); }
      });

      return {
        destroy: function () {
          offKeys();
          offSwipe();
          overlay.el.remove();
        }
      };
    }
  });
})();
