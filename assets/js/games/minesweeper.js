/* Minesweeper — 9 × 9, 10 mines, safe first click, flag mode for touch. */
(function () {
  "use strict";

  var SIZE = 9;
  var MINES = 10;

  Arcade.register({
    id: "minesweeper",
    mount: function (root) {
      var cells = [];
      var started = false;
      var over = false;
      var win = false;
      var flagMode = false;
      var startedAt = 0;
      var elapsed = 0;
      var timer = 0;

      var wrap = GameKit.el("div", "ms");
      wrap.innerHTML =
        '<div class="ms-top">' +
          '<div class="ms-counter" data-mines aria-label="Mines remaining">010</div>' +
          '<button class="ms-face" type="button" data-reset aria-label="New game">🙂</button>' +
          '<div class="ms-counter" data-time aria-label="Time">000</div>' +
        '</div>' +
        '<div class="ms-board" data-board role="grid" aria-label="Minesweeper board"></div>' +
        '<div class="ms-bottom">' +
          '<button class="ms-flag" type="button" data-flag aria-pressed="false">🚩 Flag mode: off</button>' +
          '<p class="ms-status" data-status>First click is always safe.</p>' +
        '</div>';
      root.appendChild(wrap);

      var boardEl = wrap.querySelector("[data-board]");
      var minesEl = wrap.querySelector("[data-mines]");
      var timeEl = wrap.querySelector("[data-time]");
      var flagEl = wrap.querySelector("[data-flag]");
      var statusEl = wrap.querySelector("[data-status]");
      var faceEl = wrap.querySelector("[data-reset]");

      function neighbours(index) {
        var r = Math.floor(index / SIZE);
        var c = index % SIZE;
        var out = [];
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            var nr = r + dr;
            var nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
          }
        }
        return out;
      }

      function reset() {
        cells = [];
        for (var i = 0; i < SIZE * SIZE; i++) {
          cells.push({ mine: false, open: false, flag: false, count: 0, boom: false });
        }
        started = false;
        over = false;
        win = false;
        elapsed = 0;
        startedAt = 0;
        window.clearInterval(timer);
        timer = 0;
        statusEl.textContent = "First click is always safe.";
        faceEl.textContent = "🙂";
        minesEl.textContent = "010";
        timeEl.textContent = "000";
        render();
      }

      function placeMines(safeIndex) {
        var blocked = {};
        blocked[safeIndex] = true;
        neighbours(safeIndex).forEach(function (i) { blocked[i] = true; });
        cells.forEach(function (cell, i) { if (cell.flag) blocked[i] = true; });

        var pool = [];
        for (var i = 0; i < cells.length; i++) if (!blocked[i]) pool.push(i);
        for (var n = 0; n < MINES && pool.length; n++) {
          var pick = GameKit.randInt(0, pool.length - 1);
          var index = pool.splice(pick, 1)[0];
          cells[index].mine = true;
        }
        for (var j = 0; j < cells.length; j++) {
          cells[j].count = neighbours(j).filter(function (k) { return cells[k].mine; }).length;
        }
      }

      function startClock() {
        startedAt = Date.now();
        timer = window.setInterval(function () {
          if (!started || over) return;
          elapsed = Math.floor((Date.now() - startedAt) / 1000);
          timeEl.textContent = String(Math.min(999, elapsed)).padStart(3, "0");
        }, 300);
      }

      function finish(didWin) {
        over = true;
        win = didWin;
        window.clearInterval(timer);
        timer = 0;
        if (didWin) {
          elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
          var record = GameKit.setBest("minesweeper", elapsed, "low");
          var best = record == null ? elapsed : record;
          faceEl.textContent = "😎";
          statusEl.textContent = "Cleared in " + GameKit.formatTime(elapsed) +
            (best < elapsed ? " · best " + GameKit.formatTime(best) : " · new best time");
        } else {
          faceEl.textContent = "💥";
          statusEl.textContent = "Boom. Press the face to try again.";
          cells.forEach(function (cell) {
            if (cell.mine) cell.open = true;
          });
        }
        render();
      }

      function reveal(index) {
        var cell = cells[index];
        if (over || cell.open || cell.flag) return;

        if (!started) {
          started = true;
          placeMines(index);
          startClock();
        }

        if (cell.mine) {
          cell.open = true;
          cell.boom = true;
          finish(false);
          return;
        }

        var stack = [index];
        while (stack.length) {
          var n = stack.pop();
          var current = cells[n];
          if (current.open || current.flag) continue;
          current.open = true;
          if (current.count === 0) {
            neighbours(n).forEach(function (m) {
              if (!cells[m].open && !cells[m].flag) stack.push(m);
            });
          }
        }
        render();

        var openCount = cells.filter(function (c) { return c.open && !c.mine; }).length;
        if (openCount === cells.length - MINES) {
          finish(true);
        }
      }

      function toggleFlag(index) {
        var cell = cells[index];
        if (over || cell.open) return;
        cell.flag = !cell.flag;
        render();
      }

      function flagsUsed() {
        return cells.filter(function (c) { return c.flag; }).length;
      }

      function render() {
        var html = "";
        for (var i = 0; i < cells.length; i++) {
          var cell = cells[i];
          var cls = "ms-cell";
          var label = "";
          if (cell.open) {
            cls += " open";
            if (cell.mine) {
              cls += cell.boom ? " boom" : " mine";
              label = "💣";
            } else if (cell.count) {
              cls += " n" + cell.count;
              label = String(cell.count);
            }
          } else if (cell.flag) {
            cls += " flagged";
            label = "🚩";
          }
          html += '<button type="button" class="' + cls + '" data-cell="' + i + '" role="gridcell" aria-label="Cell ' +
            (Math.floor(i / SIZE) + 1) + ", " + ((i % SIZE) + 1) + '">' + label + "</button>";
        }
        boardEl.innerHTML = html;
        minesEl.textContent = String(Math.max(0, MINES - flagsUsed())).padStart(3, "0");
        timeEl.textContent = String(Math.min(999, elapsed)).padStart(3, "0");
      }

      boardEl.addEventListener("click", function (event) {
        var target = event.target.closest("[data-cell]");
        if (!target) return;
        var index = Number(target.getAttribute("data-cell"));
        if (flagMode) toggleFlag(index);
        else reveal(index);
      });

      boardEl.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        var target = event.target.closest("[data-cell]");
        if (!target) return;
        toggleFlag(Number(target.getAttribute("data-cell")));
      });

      flagEl.addEventListener("click", function () {
        flagMode = !flagMode;
        flagEl.setAttribute("aria-pressed", String(flagMode));
        flagEl.textContent = "🚩 Flag mode: " + (flagMode ? "on" : "off");
        flagEl.classList.toggle("on", flagMode);
      });

      faceEl.addEventListener("click", reset);

      reset();

      return {
        destroy: function () {
          window.clearInterval(timer);
        }
      };
    }
  });
})();
