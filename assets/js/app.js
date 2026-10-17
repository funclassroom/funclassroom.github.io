/* Classroom — one tile per game, several sources behind each tile.
   If a source refuses to load, the player walks down the mirrors until one
   works; if every one refuses, it says so and apologises. */
(function () {
  "use strict";

  var ALL = (window.CATALOG || []).slice();
  var BY_ID = {};
  ALL.forEach(function (item) { BY_ID[item.id] = item; });

  var KEY = "classroom.state.v1";
  var LEGACY_SAVED = "gams.saved.v1";
  var LEGACY_RECENT = "gams.recent.v1";
  var MAX_RECENT = 8;
  var SLOW_LOAD_MS = 9000;
  var GIVE_UP_MS = 12000;
  var EAGER_IMAGES = 24;
  var BATCH = 120;
  var SCROLL_SAVE_MS = 350;

  var state = {
    q: "",
    sort: "hot",
    savedOnly: false,
    active: null,
    sourceIndex: 0,
    lastFocus: null,
    lastFocusId: null,
    persist: true,
    loaded: false
  };

  var dom = {};
  var store = loadStore();

  /* ---------- storage ---------- */

  function isId(value) {
    return typeof value === "string" && value.length > 0 && value.length < 120;
  }

  function emptyStore() {
    return {
      v: 2, saved: [], recent: [], sort: "hot",
      plays: {}, last: {}, scroll: 0, good: {}, bad: {}
    };
  }

  function loadStore() {
    var fresh = emptyStore();
    var raw = null;

    try { raw = JSON.parse(window.localStorage.getItem(KEY)); } catch (err) { raw = null; }

    if (!raw || typeof raw !== "object") return migrate();

    if (Array.isArray(raw.saved)) fresh.saved = raw.saved.filter(isId);
    if (Array.isArray(raw.recent)) fresh.recent = raw.recent.filter(isId).slice(0, MAX_RECENT);
    if (/^(hot|top|az)$/.test(raw.sort)) fresh.sort = raw.sort;
    if (typeof raw.scroll === "number" && raw.scroll >= 0) fresh.scroll = Math.round(raw.scroll);

    ["plays", "last", "good", "bad"].forEach(function (field) {
      if (!raw[field] || typeof raw[field] !== "object") return;
      Object.keys(raw[field]).forEach(function (key) {
        var value = raw[field][key];
        if (!isId(key) || typeof value !== "number" || !isFinite(value)) return;
        fresh[field][key] = Math.max(0, Math.round(value));
      });
    });

    return fresh;
  }

  function migrate() {
    var fresh = emptyStore();
    try {
      var saved = JSON.parse(window.localStorage.getItem(LEGACY_SAVED));
      var recent = JSON.parse(window.localStorage.getItem(LEGACY_RECENT));
      if (Array.isArray(saved)) fresh.saved = saved.filter(isId);
      if (Array.isArray(recent)) fresh.recent = recent.filter(isId).slice(0, MAX_RECENT);
      if (fresh.saved.length || fresh.recent.length) {
        window.localStorage.setItem(KEY, JSON.stringify(fresh));
        window.localStorage.removeItem(LEGACY_SAVED);
        window.localStorage.removeItem(LEGACY_RECENT);
      }
    } catch (err) { /* nothing to migrate */ }
    return fresh;
  }

  function storageWorks() {
    try {
      window.localStorage.setItem("classroom.probe", "1");
      window.localStorage.removeItem("classroom.probe");
      return true;
    } catch (err) {
      return false;
    }
  }

  function save() {
    if (!state.persist) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch (err) {
      state.persist = false;
      paintFooter();
    }
  }

  /* ---------- small helpers ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function shortNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, "") + "m";
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function ago(when) {
    if (!when) return "";
    var seconds = Math.max(0, Math.round((Date.now() - when) / 1000));
    if (seconds < 60) return "just now";
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    var days = Math.round(hours / 24);
    if (days < 7) return days + (days === 1 ? " day ago" : " days ago");
    try {
      return new Date(when).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    } catch (err) {
      return "a while ago";
    }
  }

  function playable(item) {
    return embeddable(item).length > 0;
  }

  function sorted(list) {
    var copy = list.slice();
    copy.sort(function (a, b) {
      // Games that can play inside the page always lead; the rest open in a
      // tab and sit at the end.
      if (playable(a) !== playable(b)) return playable(a) ? -1 : 1;
      if (state.sort === "az") return a.title.localeCompare(b.title);
      if (state.sort === "top") {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.plays - a.plays;
      }
      return b.plays - a.plays;
    });
    return copy;
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    return sorted(ALL.filter(function (item) {
      if (state.savedOnly && store.saved.indexOf(item.id) === -1) return false;
      if (!q) return true;
      return item.title.toLowerCase().indexOf(q) !== -1 ||
        item.id.replace(/-/g, " ").indexOf(q) !== -1;
    }));
  }

  /* ---------- tiles ---------- */

  function buildTile(item, index) {
    var tile = document.createElement("article");
    tile.className = "tile";
    tile.setAttribute("data-id", item.id);
    tile.setAttribute("data-playable", playable(item) ? "1" : "0");
    tile.setAttribute("data-rating", item.rating.toFixed(1));

    var open = document.createElement("button");
    open.type = "button";
    open.className = "tile-open";
    open.setAttribute("data-open", item.id);
    open.setAttribute("aria-label", "Play " + item.title);

    var thumb = document.createElement("span");
    thumb.className = "tile-thumb";
    thumb.setAttribute("data-initial", item.title.charAt(0));

    var img = document.createElement("img");
    img.src = item.thumb;
    img.alt = "";
    img.width = 512;
    img.height = 384;
    img.decoding = "async";
    if (index >= EAGER_IMAGES) img.setAttribute("loading", "lazy");
    img.addEventListener("error", function () {
      thumb.classList.add("is-broken");
      img.remove();
    });
    thumb.appendChild(img);

    if (item.rating > 0) {
      var rating = document.createElement("span");
      rating.className = "tile-rating";
      rating.textContent = item.rating.toFixed(1);
      thumb.appendChild(rating);
    }

    var portals = {};
    item.sources.forEach(function (source) { portals[source.portal] = true; });
    var portalsUsed = Object.keys(portals).length;
    if (portalsUsed > 1) {
      var mirrors = document.createElement("span");
      mirrors.className = "tile-mirrors";
      mirrors.textContent = item.sources.length + " routes";
      mirrors.title = item.sources.map(function (s) { return s.portal; }).join(", ");
      thumb.appendChild(mirrors);
    }

    if (store.last[item.id]) {
      var played = document.createElement("span");
      played.className = "tile-played";
      played.textContent = "Played";
      thumb.appendChild(played);
    }

    var play = document.createElement("span");
    play.className = "tile-play";
    play.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play';
    thumb.appendChild(play);

    var title = document.createElement("span");
    title.className = "tile-title";
    title.textContent = item.title;

    var meta = document.createElement("span");
    meta.className = "tile-meta";
    var visits = store.plays[item.id] || 0;
    if (visits > 1) meta.textContent = "Played " + visits + " times";
    else if (item.plays > 0) meta.textContent = shortNum(item.plays) + " plays";
    else meta.textContent = "New";

    open.appendChild(thumb);
    open.appendChild(title);
    open.appendChild(meta);

    var fav = document.createElement("button");
    fav.type = "button";
    fav.className = "tile-fav";
    fav.setAttribute("data-fav", item.id);
    var isSaved = store.saved.indexOf(item.id) !== -1;
    if (isSaved) fav.classList.add("is-on");
    fav.setAttribute("aria-pressed", isSaved ? "true" : "false");
    fav.setAttribute("aria-label", (isSaved ? "Remove " : "Save ") + item.title);
    fav.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-star"/></svg>';

    tile.appendChild(open);
    tile.appendChild(fav);
    return tile;
  }

  function renderGrid() {
    state.list = visible();
    state.rendered = 0;
    dom.grid.innerHTML = "";
    appendBatch();

    dom.shown.textContent = state.list.length === ALL.length ? "" : state.list.length + " of " + ALL.length;
    dom.empty.hidden = state.list.length !== 0;
    dom.grid.hidden = state.list.length === 0;

    if (!state.list.length) {
      var term = state.q.trim();
      dom.emptyQ.textContent = term ? '"' + term + '"' : "this filter";
    }
  }

  function appendBatch() {
    var list = state.list || [];
    var start = state.rendered;
    var end = Math.min(start + BATCH, list.length);
    var frag = document.createDocumentFragment();
    for (var i = start; i < end; i += 1) frag.appendChild(buildTile(list[i], i));
    dom.grid.appendChild(frag);
    state.rendered = end;

    var left = list.length - end;
    dom.more.hidden = left <= 0;
    if (left > 0) {
      dom.more.textContent = "Show " + Math.min(BATCH, left) + " more" +
        (left > BATCH ? " (" + left + " left)" : "");
    }
  }

  function renderSaved() {
    dom.savedCount.textContent = String(store.saved.length);
    dom.savedToggle.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
  }

  function renderContinue() {
    var id = store.recent[0];
    var item = id ? BY_ID[id] : null;

    dom.continue.hidden = !item;
    if (!item) return;

    var plays = store.plays[id] || 1;
    dom.continueTitle.textContent = item.title;
    dom.continueThumb.src = item.thumb;
    dom.continueThumb.alt = "";

    var bits = [store.last[id] ? "Last played " + ago(store.last[id]) : "Ready to play"];
    if (plays > 1) bits.push(plays + " visits");
    if (item.sources.length > 1) bits.push(item.sources.length + " sources");
    dom.continueMeta.textContent = bits.join(" · ");

    dom.continuePlay.setAttribute("data-open", id);
    dom.continueExternal.href = item.sources[0].url;
  }

  function renderRecent() {
    var items = store.recent.slice(1)
      .map(function (id) { return BY_ID[id]; })
      .filter(Boolean);

    dom.recent.hidden = items.length === 0;
    dom.recentList.innerHTML = "";
    items.forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-chip";
      chip.setAttribute("data-open", item.id);

      var img = document.createElement("img");
      img.src = item.thumb;
      img.alt = "";
      img.loading = "lazy";
      img.width = 88;
      img.height = 66;

      var text = document.createElement("span");
      text.textContent = item.title;

      chip.appendChild(img);
      chip.appendChild(text);
      dom.recentList.appendChild(chip);
    });
  }

  function paintFooter() {
    var picks = store.saved.length;
    var visits = Object.keys(store.plays).length;
    if (!state.persist) {
      dom.storageNote.textContent = "This browser is blocking storage, so nothing can be kept here.";
      dom.storageNote.classList.add("is-warn");
    } else {
      dom.storageNote.textContent = picks || visits
        ? "On this device: " + picks + (picks === 1 ? " pick, " : " picks, ") +
          visits + (visits === 1 ? " title played." : " titles played.")
        : "Picks and play history are kept in this browser.";
      dom.storageNote.classList.remove("is-warn");
    }
    dom.build.textContent = "build " + (window.CATALOG_BUILT || "local");
  }

  function render() {
    renderGrid();
    renderSaved();
    renderContinue();
    renderRecent();
    paintFooter();
  }

  /* ---------- sources ---------- */

  // Every source is attempted; the publisher decides whether it renders.
  function embeddable(item) {
    return item.sources.slice();
  }

  function sourcesFor(item) {
    var list = embeddable(item);
    var good = store.good[item.id];
    if (typeof good === "number" && good > 0 && good < list.length) {
      var preferred = list.splice(good, 1)[0];
      list.unshift(preferred);
    }
    return list;
  }

  function noteBad(portal) {
    store.bad[portal] = (store.bad[portal] || 0) + 1;
    save();
  }

  function noteGood(id, portal) {
    delete store.bad[portal];
    var index = -1;
    var item = BY_ID[id];
    if (item) {
      item.sources.forEach(function (source, i) {
        if (source.portal === portal) index = i;
      });
    }
    if (index > 0) store.good[id] = index;
    else delete store.good[id];
    save();
  }

  /* ---------- player ---------- */

  function openPlayer(id, options) {
    var item = BY_ID[id];
    if (!item || state.active === id) return;
    var opts = options || {};

    if (!state.active) {
      state.lastFocus = document.activeElement;
      state.lastFocusId = state.lastFocus && state.lastFocus.getAttribute
        ? state.lastFocus.getAttribute("data-open")
        : null;
    }

    state.active = id;
    state.sourceIndex = -1;
    state.loaded = false;

    dom.playerTitle.textContent = item.title;
    dom.playerSub.textContent = (item.rating > 0 ? item.rating.toFixed(1) + " stars · " : "") +
      (item.plays > 0 ? shortNum(item.plays) + " plays" : "new arrival");

    dom.blocked.hidden = true;
    dom.player.hidden = false;
    dom.player.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");

    rememberPlay(id);

    attemptSource(0);
    dom.close.focus({ preventScroll: true });

    if (opts.push !== false) {
      try { window.history.pushState({ p: id }, "", "#p=" + id); } catch (err) { /* file:// */ }
    }
  }

  function attemptSource(index) {
    var item = BY_ID[state.active];
    if (!item) return;

    var sources = sourcesFor(item);
    clearStage();

    if (index >= sources.length) {
      showBlocked(item, sources);
      return;
    }

    state.sourceIndex = index;
    state.loaded = false;

    var source = sources[index];
    dom.blocked.hidden = true;
    dom.loading.hidden = false;
    dom.loadingText.textContent = "Loading";
    dom.loadLink.hidden = true;
    dom.loadLink.href = source.url;
    dom.external.href = source.url;

    dom.source.textContent = sources.length > 1
      ? "Source " + (index + 1) + " of " + sources.length + " · " + source.portal
      : source.portal;
    dom.next.hidden = sources.length < 2;
    dom.next.disabled = false;

    var frame = document.createElement("iframe");
    frame.className = "player-frame";
    frame.src = source.url;
    frame.title = item.title;
    frame.setAttribute("allow", "autoplay; fullscreen; gamepad; accelerometer; gyroscope");
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("frameborder", "0");

    frame.addEventListener("load", function () {
      state.loaded = true;
      dom.loading.hidden = true;
      window.clearTimeout(dom.loadTimer);
    });

    dom.stage.appendChild(frame);

    window.clearTimeout(dom.loadTimer);
    dom.loadTimer = window.setTimeout(function () {
      if (state.loaded) {
        dom.loadLink.hidden = false;
        return;
      }
      dom.loadingText.textContent = "That source is not answering";
      window.setTimeout(function () {
        if (state.active && !state.loaded && state.sourceIndex === index) {
          noteBad(source.portal);
          nextSource(true);
        }
      }, GIVE_UP_MS - SLOW_LOAD_MS);
    }, SLOW_LOAD_MS);
  }

  function nextSource(automatic) {
    var item = BY_ID[state.active];
    if (!item) return;
    var sources = sourcesFor(item);
    var index = state.sourceIndex;

    if (index + 1 >= sources.length) {
      dom.next.disabled = true;
      showBlocked(item, sources);
      return;
    }

    if (!automatic && index >= 0) noteBad(sources[index].portal);
    attemptSource(index + 1);
  }

  function showBlocked(item, sources) {
    clearStage();
    dom.loading.hidden = true;
    dom.next.hidden = true;

    var attempt = sources.length || item.sources.length;
    dom.source.textContent = attempt + (attempt === 1 ? " source" : " sources") + " tried";
    dom.blocked.querySelector("h2").textContent = "This one would not load";

    dom.blockedText.textContent = (attempt === 1
      ? "The only source for this title gave us nothing back. "
      : "All " + attempt + " sources for this title gave us nothing back. ") +
      "That usually means the site is refusing frames or is down — not that the game is broken. " +
      "It opens fine in its own tab.";

    dom.blockedList.innerHTML = "";
    item.sources.forEach(function (source) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = source.portal + " — " + source.url.replace(/^https:\/\//, "");
      li.appendChild(link);
      dom.blockedList.appendChild(li);
    });

    var first = item.sources[0];
    dom.blockedOpen.hidden = false;
    dom.blockedOpen.href = first.url;
    dom.blockedOpen.textContent = "Open on " + first.portal;

    dom.blocked.hidden = false;
  }

  function retrySources() {
    var id = state.active;
    var item = id ? BY_ID[id] : null;
    if (!item) return;
    dom.blocked.hidden = true;
    attemptSource(0);
  }

  function clearStage() {
    window.clearTimeout(dom.loadTimer);
    var frame = $(".player-frame", dom.stage);
    if (frame) frame.remove();
  }

  function closePlayer(options) {
    var opts = options || {};
    if (!state.active) return;

    if (state.loaded && state.sourceIndex >= 0) {
      var item = BY_ID[state.active];
      var sources = item ? sourcesFor(item) : [];
      if (sources[state.sourceIndex]) noteGood(state.active, sources[state.sourceIndex].portal);
    }

    state.active = null;
    state.sourceIndex = -1;
    state.loaded = false;
    clearStage();
    dom.loading.hidden = false;
    dom.loadingText.textContent = "Loading";
    dom.loadLink.hidden = true;
    dom.blocked.hidden = true;
    dom.player.hidden = true;
    dom.player.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");

    if (document.fullscreenElement) {
      try { document.exitFullscreen(); } catch (err) { /* ignore */ }
    }

    if (opts.push !== false) {
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (err) { /* ignore */ }
    }

    var back = state.lastFocus;
    if (!back || !document.contains(back)) {
      back = state.lastFocusId
        ? document.querySelector('[data-open="' + state.lastFocusId + '"]')
        : null;
    }
    if (back && document.contains(back)) back.focus({ preventScroll: true });

    renderContinue();
    renderRecent();
    paintFooter();
  }

  function rememberPlay(id) {
    store.recent = [id].concat(store.recent.filter(function (s) { return s !== id; })).slice(0, MAX_RECENT);
    store.last[id] = Date.now();
    store.plays[id] = (store.plays[id] || 0) + 1;
    save();
    markTilePlayed(id);
    renderContinue();
    renderRecent();
    paintFooter();
  }

  function markTilePlayed(id) {
    var tile = document.querySelector('.tile[data-id="' + id + '"]');
    if (!tile) return;

    var thumb = tile.querySelector(".tile-thumb");
    if (thumb && !thumb.querySelector(".tile-played")) {
      var badge = document.createElement("span");
      badge.className = "tile-played";
      badge.textContent = "Played";
      thumb.appendChild(badge);
    }

    var meta = tile.querySelector(".tile-meta");
    var visits = store.plays[id] || 0;
    if (meta && visits > 1) meta.textContent = "Played " + visits + " times";
  }

  function toggleSaved(id) {
    var i = store.saved.indexOf(id);
    var on = i === -1;
    if (on) store.saved.unshift(id);
    else store.saved.splice(i, 1);
    save();

    var fav = document.querySelector('[data-fav="' + id + '"]');
    if (fav) {
      var item = BY_ID[id];
      fav.classList.toggle("is-on", on);
      fav.setAttribute("aria-pressed", on ? "true" : "false");
      fav.setAttribute("aria-label", (on ? "Remove " : "Save ") + (item ? item.title : id));
    }

    renderSaved();
    paintFooter();
    if (state.savedOnly) renderGrid();
  }

  function shuffle() {
    if (!ALL.length) return;
    var pick = ALL[Math.floor(Math.random() * ALL.length)];
    if (ALL.length > 1 && pick.id === state.active) {
      pick = ALL[(ALL.indexOf(pick) + 1) % ALL.length];
    }
    openPlayer(pick.id);
  }

  /* ---------- url ---------- */

  function idFromHash() {
    var hash = window.location.hash || "";
    if (hash.indexOf("#p=") !== 0) return null;
    var id = decodeURIComponent(hash.slice(3));
    return BY_ID[id] ? id : null;
  }

  function applyHash() {
    var id = idFromHash();
    if (id) openPlayer(id, { push: false });
    else closePlayer({ push: false });
  }

  /* ---------- start ---------- */

  function init() {
    dom.grid = $("#grid");
    dom.empty = $("[data-empty]");
    dom.emptyQ = $("[data-empty-q]");
    dom.shown = $("[data-shown]");
    dom.more = $("[data-more]");
    dom.count = $("[data-count]");
    dom.savedToggle = $("[data-saved-toggle]");
    dom.savedCount = $("[data-saved-count]");
    dom.continue = $("[data-continue]");
    dom.continueTitle = $("[data-continue-title]");
    dom.continueThumb = $("[data-continue-thumb]");
    dom.continueMeta = $("[data-continue-meta]");
    dom.continuePlay = $("[data-continue-play]");
    dom.continueExternal = $("[data-continue-external]");
    dom.recent = $("[data-recent]");
    dom.recentList = $("[data-recent-list]");
    dom.player = $("[data-player]");
    dom.playerTitle = $("[data-player-title]");
    dom.playerSub = $("[data-player-sub]");
    dom.stage = $("[data-stage]");
    dom.loading = $("[data-loading]");
    dom.loadingText = $("[data-loading-text]");
    dom.loadLink = $("[data-load-link]");
    dom.blocked = $("[data-blocked]");
    dom.blockedText = $("[data-blocked-text]");
    dom.blockedList = $("[data-blocked-list]");
    dom.blockedOpen = $("[data-blocked-open]");
    dom.source = $("[data-source]");
    dom.next = $("[data-next]");
    dom.close = $("[data-close]");
    dom.external = $("[data-external]");
    dom.fs = $("[data-fs]");
    dom.q = $("#q");
    dom.searchClear = $("[data-search-clear]");
    dom.clear = $("[data-clear]");
    dom.sorts = $$("[data-sort]");
    dom.storageNote = $("[data-storage-note]");
    dom.build = $("[data-build]");
    dom.reset = $("[data-reset]");

    if (!dom.grid) return;

    state.persist = storageWorks();
    state.sort = store.sort;

    dom.count.textContent = String(ALL.length);
    dom.sorts.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-sort") === state.sort ? "true" : "false");
    });

    render();

    function onSearch() {
      state.q = dom.q.value;
      dom.searchClear.hidden = state.q.length === 0;
      renderGrid();
    }

    dom.q.addEventListener("input", onSearch);

    dom.searchClear.addEventListener("click", function () {
      dom.q.value = "";
      onSearch();
      dom.q.focus();
    });

    function openFrom(event) {
      var open = event.target.closest("[data-open]");
      if (open) { openPlayer(open.getAttribute("data-open")); return true; }
      return false;
    }

    dom.grid.addEventListener("click", function (event) {
      if (openFrom(event)) return;
      var fav = event.target.closest("[data-fav]");
      if (fav) toggleSaved(fav.getAttribute("data-fav"));
    });

    dom.recentList.addEventListener("click", openFrom);
    dom.continuePlay.addEventListener("click", openFrom);

    dom.savedToggle.addEventListener("click", function () {
      state.savedOnly = !state.savedOnly;
      render();
    });

    dom.sorts.forEach(function (button) {
      button.addEventListener("click", function () {
        state.sort = button.getAttribute("data-sort");
        store.sort = state.sort;
        save();
        dom.sorts.forEach(function (other) {
          other.setAttribute("aria-pressed", other === button ? "true" : "false");
        });
        renderGrid();
      });
    });

    dom.clear.addEventListener("click", function () {
      dom.q.value = "";
      onSearch();
      dom.q.focus();
    });

    dom.more.addEventListener("click", appendBatch);
    $("[data-shuffle]").addEventListener("click", shuffle);
    dom.close.addEventListener("click", function () { closePlayer(); });
    dom.next.addEventListener("click", function () { nextSource(false); });
    $("[data-retry]").addEventListener("click", retrySources);

    dom.fs.addEventListener("click", function () {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      } else if (dom.player.requestFullscreen) {
        dom.player.requestFullscreen().catch(function () {});
      }
    });

    document.addEventListener("fullscreenchange", function () {
      dom.fs.setAttribute("aria-pressed", document.fullscreenElement ? "true" : "false");
    });

    var scrollTimer = 0;
    window.addEventListener("scroll", function () {
      if (scrollTimer) return;
      scrollTimer = window.setTimeout(function () {
        scrollTimer = 0;
        var top = window.pageYOffset || 0;
        if (Math.abs(top - store.scroll) < 24) return;
        store.scroll = Math.round(top);
        save();
      }, SCROLL_SAVE_MS);
    }, { passive: true });

    var resetArmed = false;
    var resetTimer = 0;
    dom.reset.addEventListener("click", function () {
      if (!resetArmed) {
        resetArmed = true;
        dom.reset.textContent = "Click again to clear";
        resetTimer = window.setTimeout(function () {
          resetArmed = false;
          dom.reset.textContent = "Clear saved data";
        }, 4000);
        return;
      }
      window.clearTimeout(resetTimer);
      resetArmed = false;
      dom.reset.textContent = "Clear saved data";
      store = emptyStore();
      state.savedOnly = false;
      save();
      render();
    });

    document.addEventListener("keydown", function (event) {
      var typing = /^(input|textarea|select)$/i.test(event.target.tagName);
      if (event.key === "Escape") {
        if (state.active) { event.preventDefault(); closePlayer(); return; }
        if (state.q) { dom.q.value = ""; onSearch(); return; }
        if (state.savedOnly) { state.savedOnly = false; render(); }
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        dom.q.focus();
      }
    });

    window.addEventListener("popstate", applyHash);
    window.addEventListener("hashchange", applyHash);

    var start = idFromHash();
    if (start) {
      openPlayer(start, { push: false });
    } else if (store.scroll > 0) {
      try { window.scrollTo(0, store.scroll); } catch (err) { /* ignore */ }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
