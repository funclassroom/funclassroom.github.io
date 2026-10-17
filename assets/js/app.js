/* G@M£$ — browse the wall, open a title, close it. */
(function () {
  "use strict";

  var ALL = (window.CATALOG || []).slice();
  var BY_SLUG = {};
  ALL.forEach(function (item) { BY_SLUG[item.slug] = item; });

  var KEY_SAVED = "gams.saved.v1";
  var KEY_RECENT = "gams.recent.v1";
  var MAX_RECENT = 8;
  var SLOW_LOAD_MS = 12000;
  var EAGER_IMAGES = 24;

  var state = {
    q: "",
    sort: "hot",
    savedOnly: false,
    saved: readList(KEY_SAVED),
    recent: readList(KEY_RECENT),
    active: null,
    lastFocus: null
  };

  var dom = {};

  function readList(key) {
    try {
      var raw = JSON.parse(window.localStorage.getItem(key));
      return Array.isArray(raw) ? raw.filter(function (s) { return typeof s === "string"; }) : [];
    } catch (err) {
      return [];
    }
  }

  function writeList(key, list) {
    try { window.localStorage.setItem(key, JSON.stringify(list)); } catch (err) { /* private mode */ }
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
      if (state.savedOnly && state.saved.indexOf(item.slug) === -1) return false;
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

    var play = document.createElement("span");
    play.className = "tile-play";
    play.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg>Play';
    thumb.appendChild(play);

    var title = document.createElement("span");
    title.className = "tile-title";
    title.textContent = item.title;

    var meta = document.createElement("span");
    meta.className = "tile-meta";
    meta.textContent = shortNum(item.plays) + " plays";

    open.appendChild(thumb);
    open.appendChild(title);
    open.appendChild(meta);

    var fav = document.createElement("button");
    fav.type = "button";
    fav.className = "tile-fav";
    fav.setAttribute("data-fav", item.slug);
    var isSaved = state.saved.indexOf(item.slug) !== -1;
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
    dom.savedCount.textContent = String(state.saved.length);
    dom.savedToggle.setAttribute("aria-pressed", state.savedOnly ? "true" : "false");
  }

  function renderRecent() {
    var items = state.recent.map(function (slug) { return BY_SLUG[slug]; }).filter(Boolean);
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
    renderRecent();
  }

  /* ---------- player ---------- */

  function openPlayer(slug, options) {
    var item = BY_SLUG[slug];
    if (!item || state.active === slug) return;
    var opts = options || {};

    if (!state.active) state.lastFocus = document.activeElement;
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

    touchRecent(slug);

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
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  }

  function touchRecent(slug) {
    state.recent = [slug].concat(state.recent.filter(function (s) { return s !== slug; })).slice(0, MAX_RECENT);
    writeList(KEY_RECENT, state.recent);
    renderRecent();
  }

  function toggleSaved(slug) {
    var i = state.saved.indexOf(slug);
    var on = i === -1;
    if (on) state.saved.unshift(slug);
    else state.saved.splice(i, 1);
    writeList(KEY_SAVED, state.saved);

    var fav = document.querySelector('[data-fav="' + slug + '"]');
    if (fav) {
      var item = BY_SLUG[slug];
      fav.classList.toggle("is-on", on);
      fav.setAttribute("aria-pressed", on ? "true" : "false");
      fav.setAttribute("aria-label", (on ? "Remove " : "Save ") + (item ? item.title : slug));
    }

    renderSaved();
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

    if (!dom.grid) return;

    dom.count.textContent = String(ALL.length);
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

    dom.grid.addEventListener("click", function (event) {
      var open = event.target.closest("[data-open]");
      if (open) { openPlayer(open.getAttribute("data-open")); return; }
      var fav = event.target.closest("[data-fav]");
      if (fav) toggleSaved(fav.getAttribute("data-fav"));
    });

    dom.recentList.addEventListener("click", function (event) {
      var open = event.target.closest("[data-open]");
      if (open) openPlayer(open.getAttribute("data-open"));
    });

    dom.savedToggle.addEventListener("click", function () {
      state.savedOnly = !state.savedOnly;
      render();
    });

    dom.sorts.forEach(function (button) {
      button.addEventListener("click", function () {
        state.sort = button.getAttribute("data-sort");
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
    if (start) openPlayer(start, { push: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
