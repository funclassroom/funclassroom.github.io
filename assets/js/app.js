/* Classroom — browse the wall, open a title, close it.
   Everything personal (picks, history, sort, scroll) is stored on this device. */
(function () {
  "use strict";

  var ALL = (window.CATALOG || []).slice();
  var BY_SLUG = {};
  ALL.forEach(function (item) { BY_SLUG[item.slug] = item; });

  var KEY = "classroom.state.v1";
  var LEGACY_SAVED = "gams.saved.v1";
  var LEGACY_RECENT = "gams.recent.v1";
  var MAX_RECENT = 8;
  var SLOW_LOAD_MS = 12000;
  var EAGER_IMAGES = 24;
  var SCROLL_SAVE_MS = 350;

  var state = {
    q: "",
    sort: "hot",
    savedOnly: false,
    active: null,
    lastFocus: null,
    lastFocusSlug: null,
    persist: true
  };

  var dom = {};
  var store = loadStore();

  /* ---------- on-device storage ---------- */

  function isSlug(value) {
    return typeof value === "string" && value.length > 0 && value.length < 120;
  }

  function emptyStore() {
    return { v: 1, saved: [], recent: [], sort: "hot", plays: {}, last: {}, scroll: 0 };
  }

  function loadStore() {
    var fresh = emptyStore();
    var raw = null;

    try {
      raw = JSON.parse(window.localStorage.getItem(KEY));
    } catch (err) {
      raw = null;
    }

    if (!raw || typeof raw !== "object") {
      return migrate();
    }

    if (Array.isArray(raw.saved)) fresh.saved = raw.saved.filter(isSlug);
    if (Array.isArray(raw.recent)) fresh.recent = raw.recent.filter(isSlug).slice(0, MAX_RECENT);
    if (/^(hot|top|az)$/.test(raw.sort)) fresh.sort = raw.sort;
    if (typeof raw.scroll === "number" && raw.scroll >= 0) fresh.scroll = Math.round(raw.scroll);

    if (raw.plays && typeof raw.plays === "object") {
      Object.keys(raw.plays).forEach(function (slug) {
        var count = raw.plays[slug];
        if (isSlug(slug) && typeof count === "number" && count > 0) {
          fresh.plays[slug] = Math.round(count);
        }
      });
    }

    if (raw.last && typeof raw.last === "object") {
      Object.keys(raw.last).forEach(function (slug) {
        var when = raw.last[slug];
        if (isSlug(slug) && typeof when === "number" && when > 0) fresh.last[slug] = when;
      });
    }

    return fresh;
  }

  function migrate() {
    var fresh = emptyStore();
    try {
      var saved = JSON.parse(window.localStorage.getItem(LEGACY_SAVED));
      var recent = JSON.parse(window.localStorage.getItem(LEGACY_RECENT));
      if (Array.isArray(saved)) fresh.saved = saved.filter(isSlug);
      if (Array.isArray(recent)) fresh.recent = recent.filter(isSlug).slice(0, MAX_RECENT);
      if (fresh.saved.length || fresh.recent.length) {
        window.localStorage.setItem(KEY, JSON.stringify(fresh));
        window.localStorage.removeItem(LEGACY_SAVED);
        window.localStorage.removeItem(LEGACY_RECENT);
      }
    } catch (err) {
      /* nothing to migrate */
    }
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
      paintStorageNote();
    }
  }

  function paintStorageNote() {
    if (!dom.storageNote) return;
    dom.storageNote.textContent = state.persist
      ? "Picks, history and scroll position are saved in this browser."
      : "This browser is blocking storage, so picks will not be kept.";
    dom.storageNote.classList.toggle("is-warn", !state.persist);
    if (dom.reset) dom.reset.hidden = !state.persist && !store.saved.length && !store.recent.length;
  }

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

  function sorted(list) {
    var copy = list.slice();
    copy.sort(function (a, b) {
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
      if (state.savedOnly && store.saved.indexOf(item.slug) === -1) return false;
      if (!q) return true;
      return item.title.toLowerCase().indexOf(q) !== -1 ||
        item.slug.replace(/-/g, " ").indexOf(q) !== -1;
    }));
  }

  /* ---------- tiles ---------- */

  function buildTile(item, index) {
    var tile = document.createElement("article");
    tile.className = "tile";
    tile.setAttribute("data-slug", item.slug);

    var open = document.createElement("button");
    open.type = "button";
    open.className = "tile-open";
    open.setAttribute("data-open", item.slug);
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

    if (store.last[item.slug]) {
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
    var visits = store.plays[item.slug] || 0;
    meta.textContent = visits > 1 ? "Played " + visits + " times" : shortNum(item.plays) + " plays";

    open.appendChild(thumb);
    open.appendChild(title);
    open.appendChild(meta);

    var fav = document.createElement("button");
    fav.type = "button";
    fav.className = "tile-fav";
    fav.setAttribute("data-fav", item.slug);
    var isSaved = store.saved.indexOf(item.slug) !== -1;
    if (isSaved) fav.classList.add("is-on");
    fav.setAttribute("aria-pressed", isSaved ? "true" : "false");
    fav.setAttribute("aria-label", (isSaved ? "Remove " : "Save ") + item.title);
    fav.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-star"/></svg>';

    tile.appendChild(open);
    tile.appendChild(fav);
    return tile;
  }

  function renderGrid() {
    var list = visible();
    var frag = document.createDocumentFragment();
    list.forEach(function (item, index) { frag.appendChild(buildTile(item, index)); });
    dom.grid.innerHTML = "";
    dom.grid.appendChild(frag);

    dom.shown.textContent = list.length === ALL.length ? "" : list.length + " of " + ALL.length;
    dom.empty.hidden = list.length !== 0;
    dom.grid.hidden = list.length === 0;

    if (!list.length) {
      var term = state.q.trim();
      dom.emptyQ.textContent = term ? '"' + term + '"' : "this filter";
    }
  }

  function renderSaved() {
    dom.savedCount.textContent = String(store.saved.length);
    dom.savedToggle.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
  }

  function renderContinue() {
    var slug = store.recent[0];
    var item = slug ? BY_SLUG[slug] : null;

    dom.continue.hidden = !item;
    if (!item) return;

    var plays = store.plays[slug] || 1;
    dom.continueTitle.textContent = item.title;
    dom.continueThumb.src = item.thumb;
    dom.continueThumb.alt = "";

    var bits = [];
    bits.push(store.last[slug] ? "Last played " + ago(store.last[slug]) : "Ready to play");
    if (plays > 1) bits.push(plays + " visits");
    dom.continueMeta.textContent = bits.join(" · ");

    dom.continuePlay.setAttribute("data-open", slug);
    dom.continueExternal.href = item.embed;
  }

  function renderRecent() {
    var slugs = store.recent.slice(1);
    var items = slugs.map(function (slug) { return BY_SLUG[slug]; }).filter(Boolean);
    dom.recent.hidden = items.length === 0;
    dom.recentList.innerHTML = "";
    items.forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-chip";
      chip.setAttribute("data-open", item.slug);

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

  function render() {
    renderGrid();
    renderSaved();
    renderContinue();
    renderRecent();
    paintStorageNote();
  }

  /* ---------- player ---------- */

  function openPlayer(slug, options) {
    var item = BY_SLUG[slug];
    if (!item || state.active === slug) return;
    var opts = options || {};

    if (!state.active) {
      state.lastFocus = document.activeElement;
      state.lastFocusSlug = state.lastFocus && state.lastFocus.getAttribute
        ? state.lastFocus.getAttribute("data-open")
        : null;
    }
    state.active = slug;

    dom.playerTitle.textContent = item.title;
    dom.playerSub.textContent = (item.rating > 0 ? item.rating.toFixed(1) + " stars · " : "") +
      shortNum(item.plays) + " plays";
    dom.external.href = item.embed;

    clearStage();
    dom.loading.hidden = false;
    dom.loadingText.textContent = "Loading";
    dom.loadLink.hidden = true;
    dom.loadLink.href = item.embed;

    var frame = document.createElement("iframe");
    frame.className = "player-frame";
    frame.src = item.embed;
    frame.title = item.title;
    frame.setAttribute("allow", "autoplay; fullscreen; gamepad; accelerometer; gyroscope");
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("frameborder", "0");
    frame.addEventListener("load", function () {
      dom.loading.hidden = true;
      window.clearTimeout(dom.loadTimer);
    });
    dom.stage.appendChild(frame);

    dom.loadTimer = window.setTimeout(function () {
      if (!dom.loading.hidden) {
        dom.loadingText.textContent = "Still loading";
        dom.loadLink.hidden = false;
      }
    }, SLOW_LOAD_MS);

    dom.player.hidden = false;
    dom.player.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    dom.close.focus({ preventScroll: true });

    rememberPlay(slug);

    if (opts.push !== false) {
      try { window.history.pushState({ p: slug }, "", "#p=" + slug); } catch (err) { /* file:// */ }
    }
  }

  function clearStage() {
    window.clearTimeout(dom.loadTimer);
    var frame = $(".player-frame", dom.stage);
    if (frame) frame.remove();
  }

  function closePlayer(options) {
    var opts = options || {};
    if (!state.active) return;
    state.active = null;
    clearStage();
    dom.loading.hidden = false;
    dom.loadingText.textContent = "Loading";
    dom.loadLink.hidden = true;
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
      back = state.lastFocusSlug
        ? document.querySelector('[data-open="' + state.lastFocusSlug + '"]')
        : null;
    }
    if (back && document.contains(back)) back.focus({ preventScroll: true });

    renderContinue();
    renderRecent();
  }

  function rememberPlay(slug) {
    store.recent = [slug].concat(store.recent.filter(function (s) { return s !== slug; })).slice(0, MAX_RECENT);
    store.last[slug] = Date.now();
    store.plays[slug] = (store.plays[slug] || 0) + 1;
    save();
    markTilePlayed(slug);
    renderContinue();
    renderRecent();
  }

  /* Update the one tile in place so focus and scroll are never disturbed. */
  function markTilePlayed(slug) {
    var tile = document.querySelector('.tile[data-slug="' + slug + '"]');
    if (!tile) return;

    var thumb = tile.querySelector(".tile-thumb");
    if (thumb && !thumb.querySelector(".tile-played")) {
      var badge = document.createElement("span");
      badge.className = "tile-played";
      badge.textContent = "Played";
      thumb.appendChild(badge);
    }

    var meta = tile.querySelector(".tile-meta");
    var visits = store.plays[slug] || 0;
    if (meta && visits > 1) meta.textContent = "Played " + visits + " times";
  }

  function toggleSaved(slug) {
    var i = store.saved.indexOf(slug);
    var on = i === -1;
    if (on) store.saved.unshift(slug);
    else store.saved.splice(i, 1);
    save();

    var fav = document.querySelector('[data-fav="' + slug + '"]');
    if (fav) {
      var item = BY_SLUG[slug];
      fav.classList.toggle("is-on", on);
      fav.setAttribute("aria-pressed", on ? "true" : "false");
      fav.setAttribute("aria-label", (on ? "Remove " : "Save ") + (item ? item.title : slug));
    }

    renderSaved();
    paintStorageNote();
    if (state.savedOnly) renderGrid();
  }

  function shuffle() {
    if (!ALL.length) return;
    var pick = ALL[Math.floor(Math.random() * ALL.length)];
    if (ALL.length > 1 && pick.slug === state.active) {
      pick = ALL[(ALL.indexOf(pick) + 1) % ALL.length];
    }
    openPlayer(pick.slug);
  }

  /* ---------- url ---------- */

  function slugFromHash() {
    var hash = window.location.hash || "";
    if (hash.indexOf("#p=") !== 0) return null;
    var slug = decodeURIComponent(hash.slice(3));
    return BY_SLUG[slug] ? slug : null;
  }

  function applyHash() {
    var slug = slugFromHash();
    if (slug) openPlayer(slug, { push: false });
    else closePlayer({ push: false });
  }

  /* ---------- start ---------- */

  function init() {
    dom.grid = $("#grid");
    dom.empty = $("[data-empty]");
    dom.emptyQ = $("[data-empty-q]");
    dom.shown = $("[data-shown]");
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
    dom.close = $("[data-close]");
    dom.external = $("[data-external]");
    dom.fs = $("[data-fs]");
    dom.q = $("#q");
    dom.searchClear = $("[data-search-clear]");
    dom.clear = $("[data-clear]");
    dom.sorts = $$("[data-sort]");
    dom.storageNote = $("[data-storage-note]");
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

    $("[data-shuffle]").addEventListener("click", shuffle);
    dom.close.addEventListener("click", function () { closePlayer(); });

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

    /* scroll memory */
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

    /* clear-on-device, two-step so it cannot happen by accident */
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

    var start = slugFromHash();
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
