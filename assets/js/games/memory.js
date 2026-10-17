/* Memory Match — 8 pairs, flip two at a time. */
(function () {
  "use strict";

  var PAIRS = ["🍎", "⚡", "🌙", "🎧", "🚀", "🎲", "🌵", "🐙"];

  Arcade.register({
    id: "memory",
    mount: function (root) {
      var overlay = GameKit.overlay(root);

      var deck = [];
      var cardEls = [];
      var flipped = [];
      var matched = {};
      var moves = 0;
      var started = false;
      var locked = false;
      var over = false;
      var startedAt = 0;
      var timer = 0;
      var mismatchTimer = 0;
      var best = GameKit.getBest("memory");

      var wrap = GameKit.el("div", "mem");
      wrap.innerHTML =
        '<div class="mem-top">' +
          '<div class="mem-brand"><h2>Memory Match</h2><p>Find all eight pairs.</p></div>' +
          '<div class="mem-stats">' +
            '<div class="mem-stat"><span>Moves</span><b data-moves>0</b></div>' +
            '<div class="mem-stat"><span>Time</span><b data-time>0:00</b></div>' +
            '<div class="mem-stat"><span>Fewest</span><b data-best>—</b></div>' +
          '</div>' +
          '<button class="mem-new" type="button" data-reset>New game</button>' +
        '</div>' +
        '<div class="mem-board" data-board></div>' +
        '<p class="mem-status" data-status>Flip two cards to find a pair.</p>';
      root.appendChild(wrap);

      var boardEl = wrap.querySelector("[data-board]");
      var movesEl = wrap.querySelector("[data-moves]");
      var timeEl = wrap.querySelector("[data-time]");
      var bestEl = wrap.querySelector("[data-best]");
      var statusEl = wrap.querySelector("[data-status]");

      function shuffle(list) {
        for (var i = list.length - 1; i > 0; i--) {
          var j = GameKit.randInt(0, i);
          var temp = list[i];
          list[i] = list[j];
          list[j] = temp;
        }
        return list;
      }

      function updateBest() {
        bestEl.textContent = best == null ? "—" : best + (best === 1 ? " move" : " moves");
      }

      function updateStats() {
        movesEl.textContent = String(moves);
        timeEl.textContent = GameKit.formatTime(started ? Math.floor((Date.now() - startedAt) / 1000) : 0);
      }

      function build() {
        deck = shuffle(PAIRS.concat(PAIRS));
        boardEl.innerHTML = "";
        cardEls = [];
        deck.forEach(function (symbol, index) {
          var card = document.createElement("button");
          card.type = "button";
          card.className = "mem-card";
          card.setAttribute("data-card", String(index));
          card.setAttribute("aria-label", "Card " + (index + 1));
          card.innerHTML =
            '<span class="mem-inner">' +
              '<span class="mem-face mem-back">?</span>' +
              '<span class="mem-face mem-front">' + symbol + "</span>" +
            '</span>';
          boardEl.appendChild(card);
          cardEls.push(card);
        });
      }

      function reset() {
        flipped = [];
        matched = {};
        moves = 0;
        started = false;
        locked = false;
        over = false;
        window.clearInterval(timer);
        timer = 0;
        window.clearTimeout(mismatchTimer);
        mismatchTimer = 0;
        best = GameKit.getBest("memory");
        statusEl.textContent = "Flip two cards to find a pair.";
        updateStats();
        updateBest();
        build();
      }

      function startClock() {
        started = true;
        startedAt = Date.now();
        timer = window.setInterval(function () {
          if (over) return;
          updateStats();
        }, 500);
      }

      function flip(index) {
        if (over || locked || flipped.indexOf(index) !== -1 || matched[index]) return;
        var card = cardEls[index];
        card.classList.add("flipped");

        if (!started) startClock();
        flipped.push(index);

        if (flipped.length < 2) return;

        moves += 1;
        updateStats();
        var a = flipped[0];
        var b = flipped[1];

        if (deck[a] === deck[b]) {
          matched[a] = true;
          matched[b] = true;
          cardEls[a].classList.add("matched");
          cardEls[b].classList.add("matched");
          flipped = [];
          if (Object.keys(matched).length === deck.length) finish();
        } else {
          locked = true;
          mismatchTimer = window.setTimeout(function () {
            mismatchTimer = 0;
            cardEls[a].classList.remove("flipped");
            cardEls[b].classList.remove("flipped");
            flipped = [];
            locked = false;
          }, 720);
        }
      }

      function finish() {
        over = true;
        window.clearInterval(timer);
        timer = 0;
        var elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        best = GameKit.setBest("memory", moves, "low");
        updateStats();
        updateBest();
        statusEl.textContent = "All eight pairs in " + moves + " moves.";
        overlay.show({
          kicker: "Memory Match",
          title: "All matched",
          text: moves + " moves · " + GameKit.formatTime(elapsed) +
            (best != null ? " · fewest " + best : ""),
          action: "Play again",
          onAction: function () { overlay.hide(); reset(); }
        });
      }

      boardEl.addEventListener("click", function (event) {
        var card = event.target.closest("[data-card]");
        if (!card) return;
        flip(Number(card.getAttribute("data-card")));
      });

      wrap.querySelector("[data-reset]").addEventListener("click", function () {
        overlay.hide();
        reset();
      });

      reset();

      return {
        destroy: function () {
          window.clearInterval(timer);
          window.clearTimeout(mismatchTimer);
          overlay.el.remove();
        }
      };
    }
  });
})();
