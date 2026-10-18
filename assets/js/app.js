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
  var SLOW_LOAD_MS = 12000;
  var GIVE_UP_MS = 22000;
  var EAGER_IMAGES = 24;
  var BATCH = 120;
  var SCROLL_SAVE_MS = 350;
  var EXIT_URL = "https://classroom.google.com/";

  /* Tab cloaks: the tab can look like Classroom, Google or Docs.
     Classroom is the default, so a fresh visit always opens disguised. */
  var CLOAKS = {
    classroom: {
      title: "Classroom",
      icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Crect%20width%3D%2764%27%20height%3D%2764%27%20rx%3D%2713%27%20fill%3D%27%230F9D58%27%2F%3E%3Crect%20x%3D%2711.5%27%20y%3D%2715.5%27%20width%3D%2741%27%20height%3D%2733%27%20rx%3D%273.5%27%20fill%3D%27none%27%20stroke%3D%27%23fff%27%20stroke-width%3D%273%27%2F%3E%3Ccircle%20cx%3D%2725%27%20cy%3D%2727%27%20r%3D%274.3%27%20fill%3D%27%23F4B400%27%2F%3E%3Cpath%20d%3D%27M17.2%2041.5c0-4.5%203.5-7.2%207.8-7.2s7.8%202.7%207.8%207.2z%27%20fill%3D%27%23F4B400%27%2F%3E%3Crect%20x%3D%2737.6%27%20y%3D%2723%27%20width%3D%274.2%27%20height%3D%2718.5%27%20rx%3D%272.1%27%20fill%3D%27%234285F4%27%2F%3E%3Crect%20x%3D%2745%27%20y%3D%2723%27%20width%3D%274.2%27%20height%3D%2718.5%27%20rx%3D%272.1%27%20fill%3D%27%23DB4437%27%2F%3E%3C%2Fsvg%3E"
    },
    google: {
      title: "Google",
      icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Ccircle%20cx%3D%2732%27%20cy%3D%2732%27%20r%3D%2730%27%20fill%3D%27%23ffffff%27%2F%3E%3Ctext%20x%3D%2732%27%20y%3D%2745%27%20font-family%3D%27Arial%27%20font-size%3D%2736%27%20font-weight%3D%27bold%27%20text-anchor%3D%27middle%27%20fill%3D%27%234285F4%27%3EG%3C%2Ftext%3E%3C%2Fsvg%3E"
    },
    docs: {
      title: "Google Docs",
      icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2064%2064%27%3E%3Crect%20width%3D%2764%27%20height%3D%2764%27%20rx%3D%2713%27%20fill%3D%27%234285F4%27%2F%3E%3Crect%20x%3D%2718%27%20y%3D%2712%27%20width%3D%2728%27%20height%3D%2740%27%20rx%3D%273%27%20fill%3D%27%23ffffff%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2719%27%20width%3D%2718%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%234285F4%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2727%27%20width%3D%2718%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%239ec1ff%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2735%27%20width%3D%2718%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%239ec1ff%27%2F%3E%3Crect%20x%3D%2723%27%20y%3D%2743%27%20width%3D%2712%27%20height%3D%274%27%20rx%3D%272%27%20fill%3D%27%239ec1ff%27%2F%3E%3C%2Fsvg%3E"
    }
  };

  var state = {
    q: "",
    sort: "hot",
    savedOnly: false,
    tag: "",
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
      v: 2, saved: [], recent: [], sort: "hot", cloak: "classroom",
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
    if (typeof raw.cloak === "string" && CLOAKS[raw.cloak]) fresh.cloak = raw.cloak;
    if (typeof raw.scroll === "number" && raw.scroll >= 0) fresh.scroll = Math.round(raw.scroll);

    ["plays", "last", "good", "bad"].forEach(function (field) {
      if (!raw[field] || typeof raw[field] !== "object") return;
      Object.keys(raw[field]).forEach(function (key) {
        var value = raw[field][key];
        if (!isId(key) || typeof value !== "number" || !isFinite(value)) return;
        fresh[field][key] = field === "good" || field === "bad" ? value : Math.max(0, Math.round(value));
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
      // A pinned title is the one thing the wall leads with, on every sort:
      // it is hand-added and has no play count to rank by.
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
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

  var STOP = { the: 1, a: 1, an: 1, game: 1, games: 1, free: 1, online: 1, play: 1 };

  function tagOf(item) {
    var words = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/);
    for (var i = 0; i < words.length; i += 1) {
      if (words[i].length > 2 && !STOP[words[i]]) return words[i];
    }
    return "other";
  }

  function renderTags() {
    if (!dom.tags) return;
    var counts = {};
    ALL.forEach(function (item) {
      var tag = tagOf(item);
      counts[tag] = (counts[tag] || 0) + 1;
    });

    var top = Object.keys(counts)
      .filter(function (tag) { return counts[tag] >= 25; })
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .slice(0, 12);

    dom.tags.innerHTML = "";
    top.forEach(function (tag) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "tag";
      button.setAttribute("data-tag", tag);
      button.setAttribute("aria-pressed", state.tag === tag ? "true" : "false");
      button.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
      dom.tags.appendChild(button);
    });
    dom.tags.hidden = top.length === 0;
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    return sorted(ALL.filter(function (item) {
      if (state.savedOnly && store.saved.indexOf(item.id) === -1) return false;
      if (state.tag && tagOf(item) !== state.tag) return false;
      if (!q) return true;
      var hay = item.title.toLowerCase();
      if (hay.indexOf(q) !== -1) return true;
      if (item.id.replace(/-/g, " ").indexOf(q) !== -1) return true;

      // Every word must appear somewhere: "car park" finds "Car Parking".
      var words = q.split(/\s+/).filter(Boolean);
      return words.length > 1 && words.every(function (word) {
        return hay.indexOf(word) !== -1;
      });
    }));
  }

  /* ---------- tiles ---------- */

  function buildTile(item, index) {
    var tile = document.createElement("article");
    tile.className = "tile";
    tile.setAttribute("data-id", item.id);
    tile.setAttribute("data-playable", playable(item) ? "1" : "0");
    tile.setAttribute("data-pinned", item.pinned ? "1" : "0");
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
      // Keep the wall readable when a thumbnail host is unreachable.
      thumb.classList.add("is-broken");
      img.remove();
      if (!thumb.querySelector(".tile-fallback")) {
        var fallback = document.createElement("span");
        fallback.className = "tile-fallback";
        fallback.textContent = item.title.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
        thumb.appendChild(fallback);
      }
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

  function renderPicks() {
    if (!dom.picks) return;

    // Suggestions come from what this device already played: the same first
    // word, or the same genre-ish keyword. Nothing is sent anywhere.
    var seeds = store.recent.slice(0, 4);
    var picks = [];
    var used = {};

    seeds.forEach(function (seed) {
      var item = BY_ID[seed];
      if (!item) return;
      var head = item.title.toLowerCase().split(" ")[0];
      if (head.length < 3) return;

      ALL.some(function (other) {
        if (picks.length >= 8) return true;
        if (other.id === item.id || used[other.id]) return false;
        if (other.title.toLowerCase().indexOf(head) !== 0) return false;
        if (!playable(other)) return false;
        used[other.id] = true;
        picks.push(other);
        return picks.length >= 8;
      });
    });

    if (!picks.length) {
      // First visit: show a spread rather than an empty shelf.
      picks = ALL.filter(playable).slice(0, 8);
    }

    dom.picks.hidden = picks.length < 4;
    dom.picksList.innerHTML = "";
    picks.slice(0, 8).forEach(function (item) {
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
      dom.picksList.appendChild(chip);
    });
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

  function applyCloak(name, persist) {
    if (!CLOAKS[name]) name = "classroom";
    store.cloak = name;
    document.title = CLOAKS[name].title;
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = CLOAKS[name].icon;
    if (dom.cloaks) dom.cloaks.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-cloak") === name ? "true" : "false");
    });
    if (persist) save();
  }

  function openBlank() {
    // Reopen this page inside an about:blank tab so the address bar
    // shows nothing at all. No network, just an iframe of this page.
    var win = window.open("about:blank", "_blank");
    if (!win) return;
    var url = window.location.href.replace(/</g, "%3C");
    win.document.write(
      "<!doctype html><html><head><title>Classroom</title></head>" +
      "<body style='margin:0'><iframe src='" + url + "' style='border:0;width:100vw;height:100vh' allowfullscreen></iframe></body></html>"
    );
    win.document.close();
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
    renderPicks();
    paintFooter();
  }

  /* ---------- sources ---------- */

  // Every source is attempted; the publisher decides whether it renders.
  function embeddable(item) {
    return item.sources.slice();
  }

  function sourcesFor(item) {
    var list = embeddable(item);

    // Portals this device cannot reach go to the back of the queue, so a
    // blocked host does not cost a wait on every single tile.
    list.sort(function (a, b) {
      return (store.bad[a.portal] ? 1 : 0) - (store.bad[b.portal] ? 1 : 0);
    });

    // A portal that played last time comes first for the same title.
    var good = store.good[item.id];
    if (typeof good === "string") {
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].portal === good) {
          list.unshift(list.splice(i, 1)[0]);
          break;
        }
      }
    } else if (typeof good === "number" && good > 0 && good < list.length) {
      list.unshift(list.splice(good, 1)[0]);
    }
    return list;
  }

  function noteBad(portal) {
    store.bad[portal] = (store.bad[portal] || 0) + 1;
    save();
  }

  function noteGood(id, portal) {
    delete store.bad[portal];
    store.good[id] = portal;
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

    // Freeze the order for this session: a portal failing mid-way must not
    // shuffle the queue under the user's feet.
    state.queue = sourcesFor(item);
    attemptSource(0);
    dom.close.focus({ preventScroll: true });

    if (opts.push !== false) {
      try { window.history.pushState({ p: id }, "", "#p=" + id); } catch (err) { /* file:// */ }
    }
  }

  function syncPlayerFav(item) {
    if (!dom.playerFav) return;
    var on = store.saved.indexOf(item.id) !== -1;
    dom.playerFav.classList.toggle("is-on", on);
    dom.playerFav.setAttribute("aria-pressed", on ? "true" : "false");
    dom.playerFav.setAttribute("aria-label", (on ? "Remove " : "Save ") + item.title);
  }

  function attemptSource(index) {
    var item = BY_ID[state.active];
    if (!item) return;

    var sources = state.queue && state.queue.length ? state.queue : sourcesFor(item);
    clearStage();

    if (index >= sources.length) {
      showBlocked(item, sources);
      return;
    }

    state.sourceIndex = index;
    state.loaded = false;

    var source = sources[index];
    state.currentId = state.active;
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
    syncPlayerFav(item);
    dom.next.disabled = false;

    mountFrame(item, source, sources, index);
  }

  function mountFrame(item, source, sources, index) {
    var frame = document.createElement("iframe");
    frame.className = "player-frame";
    frame.src = source.url;
    frame.title = item.title;
    // pointer-lock is what lets a game capture the mouse inside the frame;
    // Minecraft's look controls are dead without it.
    frame.setAttribute(
      "allow",
      "autoplay; fullscreen; gamepad; pointer-lock; accelerometer; gyroscope"
    );
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("frameborder", "0");

    frame.addEventListener("load", function () {
      // The document answered. Whether it then draws a game is the
      // publisher's business, and there is no honest way for this page to
      // see inside a cross-origin frame — so never call it broken here.
      state.loaded = true;
      state.loadingFrame = false;
      dom.loading.hidden = true;
      window.clearTimeout(dom.loadTimer);
      window.clearTimeout(dom.slowTimer);
    });

    dom.stage.appendChild(frame);

    // The overlay must never be the thing that hides a working game: it comes
    // away after a moment whether or not `load` fired.
    window.clearTimeout(dom.loadTimer);
    dom.loadTimer = window.setTimeout(function () {
      dom.loading.hidden = true;
    }, 3500);

    window.clearTimeout(dom.slowTimer);
    dom.slowTimer = window.setTimeout(function () {
      if (state.loaded) return;
      dom.loadLink.hidden = false;
      dom.source.textContent = "still loading — use “Try another source” if it stays blank";
    }, SLOW_LOAD_MS);
  }

  function nextSource(automatic) {
    var item = BY_ID[state.active];
    if (!item) return;
    var sources = state.queue && state.queue.length ? state.queue : sourcesFor(item);
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
    // Rebuild the queue: portals that failed are now last, so a retry starts
    // with one that has not been given a chance yet.
    state.queue = sourcesFor(item);
    attemptSource(0);
  }

  function clearStage() {
    window.clearTimeout(dom.loadTimer);
    window.clearTimeout(dom.slowTimer);
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
    state.queue = null;
    state.loaded = false;
    state.loadingFrame = false;
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
    renderPicks();
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
    renderPicks();
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
    dom.tags = $("[data-tags]");
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
    dom.picks = $("[data-picks]");
    dom.picksList = $("[data-picks-list]");
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
    dom.playerFav = $("[data-player-fav]");
    dom.fs = $("[data-fs]");
    dom.q = $("#q");
    dom.searchClear = $("[data-search-clear]");
    dom.clear = $("[data-clear]");
    dom.sorts = $$("[data-sort]");
    dom.storageNote = $("[data-storage-note]");
    dom.build = $("[data-build]");
    dom.reset = $("[data-reset]");
    dom.cloaks = $$("[data-cloak]");
    dom.blank = $("[data-blank]");

    if (!dom.grid) return;

    state.persist = storageWorks();
    state.sort = store.sort;
    applyCloak(store.cloak, false);

    dom.count.textContent = String(ALL.length);
    var footCount = $("[data-foot-count]");
    if (footCount) footCount.textContent = ALL.length.toLocaleString("en-GB");
    dom.sorts.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-sort") === state.sort ? "true" : "false");
    });

    renderTags();
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

    dom.tags.addEventListener("click", function (event) {
      var button = event.target.closest("[data-tag]");
      if (!button) return;
      var tag = button.getAttribute("data-tag");
      state.tag = state.tag === tag ? "" : tag;
      Array.prototype.forEach.call(dom.tags.children, function (child) {
        child.setAttribute("aria-pressed", child.getAttribute("data-tag") === state.tag ? "true" : "false");
      });
      renderGrid();
    });

    dom.grid.addEventListener("click", function (event) {
      if (openFrom(event)) return;
      var fav = event.target.closest("[data-fav]");
      if (fav) toggleSaved(fav.getAttribute("data-fav"));
    });

    dom.recentList.addEventListener("click", openFrom);
    dom.picksList.addEventListener("click", openFrom);
    dom.continuePlay.addEventListener("click", openFrom);

    dom.savedToggle.addEventListener("click", function () {
      state.savedOnly = !state.savedOnly;
      render();
    });

    if (dom.cloaks) dom.cloaks.forEach(function (button) {
      button.addEventListener("click", function () {
        applyCloak(button.getAttribute("data-cloak"), true);
      });
    });

    if (dom.blank) dom.blank.addEventListener("click", openBlank);

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
    dom.playerFav.addEventListener("click", function () {
      if (!state.active) return;
      toggleSaved(state.active);
      syncPlayerFav(BY_ID[state.active]);
    });

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
      // Panic key: one tap and the tab looks like homework again.
      if (event.key === "`" && !typing) {
        window.location.href = EXIT_URL;
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
