/* ============================================================
   MadKid Classroom — UI, routing, disguise, player.
   Plain DOM. No framework, no build step.
   ============================================================ */
(function () {
  "use strict";

  var CATALOG = window.GAME_CATALOG || [];
  var META = window.CLASSROOM_META || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var state = {
    mode: "classroom",
    gc: { classId: null, tab: "stream" },
    mk: { query: "", category: "All" },
    active: null,
    done: {}
  };

  var gameInstance = null;
  var stageEl = null;
  var playerEl = null;
  var gcView = null;
  var mkView = null;
  var searchEl = null;
  var drawerScrim = null;

  var FAV_CLASSROOM = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" rx="6" fill="#1e8e3e"/>' +
    '<path d="M16 7 27 12 16 17 5 12Z" fill="#fff"/>' +
    '<path d="M9 14.6v4.1c0 2 3.1 3.6 7 3.6s7-1.6 7-3.6v-4.1l-7 3.2z" fill="#fff" opacity=".85"/></svg>'
  );
  var FAV_GAMES = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" rx="6" fill="#7c5cff"/>' +
    '<rect x="6" y="11" width="20" height="12" rx="6" fill="#ffcc00"/>' +
    '<rect x="10" y="15.2" width="6" height="2" rx="1" fill="#1a1a1a"/>' +
    '<rect x="12" y="13.2" width="2" height="6" rx="1" fill="#1a1a1a"/>' +
    '<circle cx="21" cy="15.5" r="1.6" fill="#1a1a1a"/>' +
    '<circle cx="23.4" cy="19" r="1.6" fill="#1a1a1a"/></svg>'
  );

  var AVATAR_COLORS = ["#1a73e8", "#188038", "#d93025", "#e8710a", "#7627bb", "#007b83", "#b80672", "#5f6368"];
  var FILLERS = [
    { title: "Warm-Up — Vocabulary Check", due: "Tomorrow, 8:00 AM", points: 5 },
    { title: "Unit Review", due: "Next Monday", points: 10 }
  ];

  /* ----------------------------------------------------------
     helpers
     ---------------------------------------------------------- */
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function getGame(id) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
    return null;
  }

  function indexOfGame(id) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return i;
    return 0;
  }

  function shade(hex) {
    var h = String(hex || "#1e8e3e").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "#0b8043";
    var r = Math.max(0, ((n >> 16) & 255) - 46);
    var g = Math.max(0, ((n >> 8) & 255) - 46);
    var b = Math.max(0, (n & 255) - 46);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function initial(name) {
    var clean = String(name || "?").replace(/^(Mr|Mrs|Ms|Dr|Coach)\.?\s+/i, "").trim();
    return (clean.charAt(0) || "?").toUpperCase();
  }

  function avatarColor(name) {
    var sum = 0;
    var text = String(name || "");
    for (var i = 0; i < text.length; i++) sum += text.charCodeAt(i);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  }

  function avatar(name, cls) {
    var color = avatarColor(name);
    return '<span class="gc-avatar ' + (cls || "") + '" style="background:' + color +
      '22;color:' + color + '" aria-hidden="true">' + esc(initial(name)) + "</span>";
  }

  function emailFor(name) {
    return String(name || "").toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, ".") + "@northfield.edu";
  }

  function toast(message) {
    GameKit.announce(message);
  }

  function bestText(game) {
    var value = GameKit.getBest(game.id);
    if (value == null) return "—";
    if (game.scoreFormat === "time") return GameKit.formatTime(value);
    if (game.scoreFormat === "moves") return value + (value === 1 ? " move" : " moves");
    return String(value);
  }

  function categories() {
    var list = ["All"];
    CATALOG.forEach(function (game) {
      if (list.indexOf(game.category) === -1) list.push(game.category);
    });
    return list;
  }

  /* ----------------------------------------------------------
     classroom: home
     ---------------------------------------------------------- */
  function classCard(game) {
    var klass = game.class;
    return '<button class="gc-card" data-action="open-class" data-id="' + esc(game.id) + '" ' +
      'aria-label="Open ' + esc(klass.subject) + '">' +
      '<span class="gc-card-banner" style="background:linear-gradient(135deg,' + klass.color + ',' + shade(klass.color) + ')">' +
        '<span class="gc-card-subject">' + esc(klass.subject) + '</span>' +
        '<span class="gc-card-section">' + esc(klass.section) + '</span>' +
      '</span>' +
      '<span class="gc-card-body">' +
        avatar(klass.teacher) +
        '<span class="gc-card-teacher">' + esc(klass.teacher) + '</span>' +
      '</span>' +
    '</button>';
  }

  function homeHTML() {
    return '<div class="gc-home">' +
      '<div class="gc-home-head"><h1>Your classes</h1>' +
        '<button class="gc-link" data-action="archived">Archived classes</button></div>' +
      '<div class="gc-class-grid">' +
        CATALOG.map(classCard).join("") +
        '<button class="gc-join" data-action="join"><span class="gc-join-plus">+</span><span>Join class</span></button>' +
      '</div>' +
      '<p class="gc-home-foot">' + esc(META.school || "") + ' · ' + esc(META.year || "") + '</p>' +
    '</div>';
  }

  /* ----------------------------------------------------------
     classroom: class page
     ---------------------------------------------------------- */
  function tabButton(id, label, active) {
    return '<button class="gc-tab' + (active ? " active" : "") + '" role="tab" aria-selected="' +
      (active ? "true" : "false") + '" data-action="tab" data-tab="' + id + '">' + label + "</button>";
  }

  function assignmentPost(game) {
    var klass = game.class;
    return '<article class="gc-post">' +
      avatar(klass.teacher) +
      '<div class="gc-post-body">' +
        '<p class="gc-post-head"><b>' + esc(klass.teacher) + '</b><span> · Today</span></p>' +
        '<p class="gc-post-text">posted a new assignment: <b>' + esc(klass.assignment) + '</b></p>' +
        '<button class="gc-attach" data-action="open-game" data-id="' + esc(game.id) + '">' +
          '<span class="gc-attach-icon"><svg class="icon"><use href="#i-assignment"/></svg></span>' +
          '<span class="gc-attach-text"><b>' + esc(klass.assignment) + '</b>' +
            '<small>Due ' + esc(klass.due) + ' · ' + klass.points + ' points</small></span>' +
          '<span class="gc-attach-cta">View</span>' +
        '</button>' +
      '</div>' +
    '</article>';
  }

  function notePost(author, text, when) {
    return '<article class="gc-post">' +
      avatar(author) +
      '<div class="gc-post-body">' +
        '<p class="gc-post-head"><b>' + esc(author) + '</b><span> · ' + esc(when) + '</span></p>' +
        '<p class="gc-post-text">' + esc(text) + '</p>' +
      '</div>' +
    '</article>';
  }

  function streamHTML(game) {
    var klass = game.class;
    var extras = META.streamExtras || [];
    var extra = extras[indexOfGame(game.id) % Math.max(1, extras.length)] || "";
    var general = (META.generalAnnouncements || [])[0];
    return '<div class="gc-stream">' +
      '<div class="gc-feed">' +
        '<button class="gc-compose" data-action="compose">' +
          avatar((META.student && META.student.name) || "Sam") +
          '<span class="gc-compose-input">Announce something to your class</span>' +
        '</button>' +
        assignmentPost(game) +
        (extra ? notePost(klass.teacher, extra, "Yesterday") : "") +
        (general ? notePost(general.author, general.text, general.when) : "") +
      '</div>' +
      '<aside class="gc-upcoming">' +
        '<h2>Upcoming</h2>' +
        '<button class="gc-due" data-action="open-game" data-id="' + esc(game.id) + '">' +
          '<span>Due ' + esc(klass.due) + '</span><b>' + esc(klass.assignment) + '</b></button>' +
        '<button class="gc-due" data-action="filler">' +
          '<span>Due Tomorrow</span><b>' + esc(FILLERS[0].title) + '</b></button>' +
        '<button class="gc-link gc-link-left" data-action="filler">View all</button>' +
        '<p class="gc-upcoming-note">' + esc(META.school || "") + '</p>' +
      '</aside>' +
    '</div>';
  }

  function classworkRow(game, real) {
    var klass = game.class;
    var title = real ? klass.assignment : FILLERS[0].title;
    var due = real ? klass.due : FILLERS[0].due;
    var points = real ? klass.points : FILLERS[0].points;
    var action = real ? "open-game" : "filler";
    return '<button class="gc-cw-row" data-action="' + action + '"' +
      (real ? ' data-id="' + esc(game.id) + '"' : "") + '>' +
      '<span class="gc-cw-icon"><svg class="icon"><use href="#i-assignment"/></svg></span>' +
      '<span class="gc-cw-text"><b>' + esc(title) + '</b><small>Posted Monday</small></span>' +
      '<span class="gc-cw-due">Due ' + esc(due) + '<small>' + points + ' points</small></span>' +
      '<span class="gc-cw-open">' + (real ? "Open" : "View") + '</span>' +
    '</button>';
  }

  function classworkHTML(game) {
    return '<div class="gc-cw">' +
      '<div class="gc-cw-head"><h2>Classwork</h2><span class="gc-select">All topics' +
        '<svg class="icon"><use href="#i-chevron"/></svg></span></div>' +
      '<p class="gc-topic-label">Assignments</p>' +
      classworkRow(game, true) +
      '<button class="gc-cw-row" data-action="filler">' +
        '<span class="gc-cw-icon"><svg class="icon"><use href="#i-folder"/></svg></span>' +
        '<span class="gc-cw-text"><b>' + esc(FILLERS[1].title) + '</b><small>Posted last week</small></span>' +
        '<span class="gc-cw-due">Due ' + esc(FILLERS[1].due) + '<small>' + FILLERS[1].points + ' points</small></span>' +
        '<span class="gc-cw-open">View</span>' +
      '</button>' +
      '<p class="gc-cw-note">Assignments are posted here in the order they are added.</p>' +
    '</div>';
  }

  function personRow(name, subtitle, isSelf) {
    return '<div class="gc-person">' + avatar(name) +
      '<div class="gc-person-text"><b>' + esc(name) + (isSelf ? " (you)" : "") + '</b>' +
      '<small>' + esc(subtitle) + '</small></div></div>';
  }

  function peopleHTML(game) {
    var klass = game.class;
    var self = (META.student && META.student.name) || "Sam Carter";
    var roster = META.roster || [];
    return '<div class="gc-people">' +
      '<h2>Teachers</h2>' +
      personRow(klass.teacher, klass.email, false) +
      '<h2>Students <span class="gc-count">' + (roster.length + 1) + '</span></h2>' +
      personRow(self, emailFor(self), true) +
      roster.map(function (name) { return personRow(name, emailFor(name), false); }).join("") +
    '</div>';
  }

  function classHTML(game) {
    var klass = game.class;
    var tab = state.gc.tab;
    var body = tab === "classwork" ? classworkHTML(game) : tab === "people" ? peopleHTML(game) : streamHTML(game);
    return '<div class="gc-class">' +
      '<div class="gc-banner" style="background:linear-gradient(135deg,' + klass.color + ',' + shade(klass.color) + ')">' +
        '<button class="gc-iconbtn gc-banner-back" data-action="home" aria-label="Back to classes">' +
          '<svg class="icon"><use href="#i-back"/></svg></button>' +
        '<div class="gc-banner-text"><h1>' + esc(klass.subject) + '</h1><p>' + esc(klass.section) + '</p></div>' +
        '<div class="gc-banner-teacher">' + avatar(klass.teacher) + '<span>' + esc(klass.teacher) + '</span></div>' +
      '</div>' +
      '<nav class="gc-tabs" role="tablist" aria-label="Class sections">' +
        tabButton("stream", "Stream", tab === "stream") +
        tabButton("classwork", "Classwork", tab === "classwork") +
        tabButton("people", "People", tab === "people") +
      '</nav>' +
      '<div class="gc-tabpanel" role="tabpanel">' + body + '</div>' +
    '</div>';
  }

  function renderClassroom() {
    if (!gcView) return;
    var game = state.gc.classId ? getGame(state.gc.classId) : null;
    gcView.innerHTML = game ? classHTML(game) : homeHTML();
  }

  /* ----------------------------------------------------------
     games mode
     ---------------------------------------------------------- */
  function filteredGames() {
    var query = state.mk.query.trim().toLowerCase();
    return CATALOG.filter(function (game) {
      if (state.mk.category !== "All" && game.category !== state.mk.category) return false;
      if (!query) return true;
      var haystack = [game.title, game.tagline, game.category].concat(game.tags || []).join(" ").toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  function heroHTML() {
    var tiles = CATALOG.slice(0, 3).map(function (game, i) {
      return '<span class="mk-hero-tile mk-hero-tile-' + i + '" style="background:' + game.art.bg + ";color:" + game.art.fg + '">' +
        '<svg viewBox="0 0 64 64" aria-hidden="true">' + game.art.glyph + "</svg></span>";
    }).join("");
    return '<section class="mk-hero">' +
      '<div class="mk-hero-copy">' +
        '<p class="mk-eyebrow">MadKid Arcade · ' + CATALOG.length + ' games</p>' +
        '<h1>Play something.<br>Then look very busy.</h1>' +
        '<p class="mk-hero-lede">Every game is built into this page — no downloads, no dead iframes, ' +
          'no placeholder links. Best scores stay on this device.</p>' +
        '<p class="mk-panic"><kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>K</kbd>' +
          '<span class="mk-panic-text">turns the whole page into Classroom, title and favicon included</span></p>' +
      '</div>' +
      '<div class="mk-hero-art" aria-hidden="true">' + tiles + '</div>' +
    '</section>';
  }

  function toolbarHTML(list) {
    var chips = categories().map(function (cat) {
      var active = state.mk.category === cat;
      return '<button class="mk-chip' + (active ? " active" : "") + '" data-action="category" data-cat="' +
        esc(cat) + '" aria-pressed="' + active + '">' + esc(cat) + "</button>";
    }).join("");
    return '<div class="mk-toolbar">' +
      '<div class="mk-chips" role="group" aria-label="Filter games">' + chips + '</div>' +
      '<p class="mk-count">' + list.length + (list.length === 1 ? " game" : " games") + '</p>' +
    '</div>';
  }

  function gameCard(game) {
    return '<button class="mk-card" data-action="play" data-id="' + esc(game.id) + '">' +
      '<span class="mk-art" style="background:' + game.art.bg + ";color:" + game.art.fg + '">' +
        '<span class="mk-art-glyph"><svg viewBox="0 0 64 64" aria-hidden="true">' + game.art.glyph + "</svg></span>" +
        '<span class="mk-cat">' + esc(game.category) + '</span>' +
      '</span>' +
      '<span class="mk-card-body">' +
        '<span class="mk-card-title">' + esc(game.title) +
          '<span class="mk-play-icon"><svg class="icon"><use href="#i-play"/></svg></span></span>' +
        '<span class="mk-card-desc">' + esc(game.tagline) + '</span>' +
        '<span class="mk-card-foot"><span>' + esc(game.scoreLabel) + ": <b>" + esc(bestText(game)) +
          '</b></span><span>' + esc(game.controls) + '</span></span>' +
      '</span>' +
    '</button>';
  }

  function emptyHTML() {
    return '<div class="mk-empty">' +
      '<h3>No games found</h3>' +
      '<p>Nothing matches “' + esc(state.mk.query) + '”. Try a different word or clear the filters.</p>' +
      '<button class="mk-btn mk-btn-solid" data-action="clear-filters">Clear filters</button>' +
    '</div>';
  }

  function footerHTML() {
    return '<footer class="mk-foot">' +
      '<p>Built-in arcade · progress and best scores live in this browser only.</p>' +
      '<p class="mk-joke">If a web filter blocks this page, it owes you one (1) unpaid debt. ' +
        '<span>Satire. A page cannot create a debt, and filters block by domain long before JavaScript runs.</span></p>' +
    '</footer>';
  }

  function renderGames() {
    if (!mkView) return;
    var list = filteredGames();
    mkView.innerHTML = heroHTML() + toolbarHTML(list) +
      (list.length ? '<div class="mk-grid">' + list.map(gameCard).join("") + "</div>" : emptyHTML()) +
      footerHTML();
  }

  /* ----------------------------------------------------------
     player
     ---------------------------------------------------------- */
  function classroomPlayerHTML(game) {
    var klass = game.class;
    var done = !!state.done[game.id];
    var instructions = (klass.instructions || []).map(function (line) {
      return "<li>" + esc(line) + "</li>";
    }).join("");
    return '<div class="player-skin player-skin-classroom">' +
      '<header class="gc-topbar player-bar">' +
        '<button class="gc-iconbtn" data-action="close-player" aria-label="Back to class">' +
          '<svg class="icon"><use href="#i-back"/></svg></button>' +
        '<span class="gc-crumb"><span>' + esc(klass.subject) + '</span>' +
          '<span class="gc-crumb-sep">›</span><b>Assignment</b></span>' +
        '<div class="gc-spacer"></div>' +
        '<button class="gc-iconbtn" data-action="toggle-mode" aria-label="Apps" title="Apps">' +
          '<svg class="icon"><use href="#i-apps"/></svg></button>' +
        '<span class="gc-avatar gc-avatar-head" aria-hidden="true">S</span>' +
      '</header>' +
      '<main class="assignment">' +
        '<div class="assignment-inner">' +
          '<div class="assignment-head">' +
            '<span class="assignment-badge" style="background:' + klass.color + '">' +
              '<svg class="icon"><use href="#i-assignment"/></svg></span>' +
            '<div class="assignment-title"><h1>' + esc(klass.assignment) + '</h1>' +
              '<p>' + esc(klass.teacher) + ' · ' + esc(klass.subject) + ' · ' + esc(klass.section) + '</p></div>' +
            '<div class="assignment-points"><b>' + klass.points + '</b><span>points</span></div>' +
          '</div>' +
          '<div class="assignment-grid">' +
            '<div class="assignment-main">' +
              '<section class="material" data-fs-target>' +
                '<div class="material-head">' +
                  '<div><p class="material-kicker">Interactive activity</p>' +
                    '<h2>Complete the activity</h2>' +
                    '<p class="material-sub">Part of this assignment · best score saved on this device</p></div>' +
                  '<button class="gc-iconbtn" data-action="fullscreen" aria-label="Fullscreen" title="Fullscreen">' +
                    '<svg class="icon"><use href="#i-fullscreen"/></svg></button>' +
                '</div>' +
                '<div class="game-slot material-stage" data-stage-slot></div>' +
                '<p class="material-hint">' + esc(game.controls) + ' · best score saved on this device</p>' +
              '</section>' +
              '<section class="material-note"><h3>Instructions</h3><ol>' + instructions + '</ol></section>' +
              '<div class="gc-comment">' + avatar((META.student && META.student.name) || "Sam") +
                '<input type="text" placeholder="Add a private comment" aria-label="Add a private comment" data-private-comment>' +
              '</div>' +
            '</div>' +
            '<aside class="assignment-side">' +
              '<section class="turnin">' +
                '<h3>Your work</h3>' +
                '<p class="turnin-status' + (done ? " done" : "") + '" data-turnin-status>' +
                  (done ? "Done" : "Assigned") + '</p>' +
                '<button class="gc-btn primary" data-action="mark-done" data-id="' + esc(game.id) + '">' +
                  (done ? "Undo" : "Mark as done") + '</button>' +
              '</section>' +
              '<section class="due-panel">' +
                '<p><span>Due</span><b>' + esc(klass.due) + '</b></p>' +
                '<p><span>Points</span><b>' + klass.points + '</b></p>' +
                '<p><span>Class</span><b>' + esc(klass.subject) + '</b></p>' +
              '</section>' +
            '</aside>' +
          '</div>' +
        '</div>' +
      '</main>' +
    '</div>';
  }

  function gamesPlayerHTML(game) {
    return '<div class="player-skin player-skin-games">' +
      '<header class="mk-topbar mk-playbar">' +
        '<button class="mk-iconbtn" data-action="close-player" aria-label="Back to games">' +
          '<svg class="icon"><use href="#i-back"/></svg></button>' +
        '<div class="mk-play-title"><b>' + esc(game.title) + '</b><span>' + esc(game.category) + '</span></div>' +
        '<div class="mk-spacer"></div>' +
        '<p class="mk-best" data-best>' + esc(game.scoreLabel) + ': <b>' + esc(bestText(game)) + '</b></p>' +
        '<button class="mk-iconbtn" data-action="fullscreen" aria-label="Fullscreen" title="Fullscreen">' +
          '<svg class="icon"><use href="#i-fullscreen"/></svg></button>' +
        '<button class="mk-btn mk-btn-quiet" data-action="toggle-mode">' +
          '<svg class="icon"><use href="#i-eye-off"/></svg><span>Classroom</span></button>' +
      '</header>' +
      '<div class="mk-play-wrap" data-fs-target>' +
        '<div class="game-slot mk-play-stage" data-stage-slot></div>' +
        '<p class="mk-play-hint">' + esc(game.controls) + ' · <span>' + esc(game.tagline) + '</span></p>' +
      '</div>' +
    '</div>';
  }

  function fitStage() {
    if (!stageEl) return;
    var game = state.active ? getGame(state.active) : null;
    if (!game) return;
    var ratio = game.ratio || 1.6;
    var target = stageEl.closest("[data-fs-target]");
    var fullscreen = !!(document.fullscreenElement && target && document.fullscreenElement === target);

    if (state.mode === "games" || fullscreen) {
      var maxW = fullscreen ? window.innerWidth - 32 : Math.min(1040, window.innerWidth - 56);
      var maxH = fullscreen ? window.innerHeight - 32 : window.innerHeight - 190;
      var width = Math.max(260, Math.min(maxW, Math.max(200, maxH) * ratio));
      stageEl.style.width = Math.round(width) + "px";
      stageEl.style.height = Math.round(width / ratio) + "px";
    } else {
      stageEl.style.width = "";
      stageEl.style.height = "";
    }
  }

  function renderPlayer() {
    if (!playerEl) return;
    var game = state.active ? getGame(state.active) : null;
    if (!game) {
      playerEl.hidden = true;
      playerEl.innerHTML = "";
      document.body.classList.remove("playing");
      if (stageEl) {
        stageEl.remove();
        stageEl = null;
      }
      return;
    }

    playerEl.hidden = false;
    playerEl.innerHTML = state.mode === "classroom" ? classroomPlayerHTML(game) : gamesPlayerHTML(game);
    document.body.classList.add("playing");
    var slot = playerEl.querySelector("[data-stage-slot]");
    if (slot && stageEl) slot.appendChild(stageEl);
    fitStage();
  }

  function ensureStage(game) {
    if (stageEl) return;
    stageEl = document.createElement("div");
    stageEl.className = "game-stage";
    stageEl.id = "game-stage";
    stageEl.style.setProperty("--ar", String(game.ratio || 1.6));

    var definition = window.Arcade ? window.Arcade.get(game.id) : null;
    if (!definition) {
      stageEl.innerHTML = '<p class="stage-error">This game has not been registered.</p>';
      return;
    }
    try {
      gameInstance = definition.mount(stageEl) || null;
    } catch (error) {
      gameInstance = null;
      stageEl.innerHTML = '<p class="stage-error">The activity could not start. ' + esc(error.message) + '</p>';
      if (window.console) window.console.error(error);
    }
  }

  function releaseStage() {
    if (gameInstance && typeof gameInstance.destroy === "function") {
      try { gameInstance.destroy(); } catch (error) { if (window.console) window.console.error(error); }
    }
    gameInstance = null;
    if (stageEl) {
      stageEl.innerHTML = "";
      stageEl.remove();
      stageEl = null;
    }
  }

  function openGame(id) {
    var game = getGame(id);
    if (!game) return;
    if (state.active && state.active !== id) releaseStage();
    state.active = id;
    state.gc.classId = id;
    ensureStage(game);
    render();
  }

  function closePlayer() {
    releaseStage();
    state.active = null;
    render();
  }

  /* ----------------------------------------------------------
     chrome (title, favicon, mode)
     ---------------------------------------------------------- */
  function syncChrome() {
    var game = state.active ? getGame(state.active) : null;
    var title;
    var icon;

    if (state.mode === "games") {
      title = game ? game.title + " — MadKid Games" : "MadKid Games — Play free HTML5 games";
      icon = FAV_GAMES;
    } else if (game) {
      title = game.class.assignment + " - " + game.class.subject;
      icon = FAV_CLASSROOM;
    } else if (state.gc.classId) {
      var current = getGame(state.gc.classId);
      title = current ? current.class.subject : "Classes";
      icon = FAV_CLASSROOM;
    } else {
      title = "Classes";
      icon = FAV_CLASSROOM;
    }

    document.title = title;
    var link = document.querySelector("link[rel='icon']");
    if (link) link.href = icon;

    document.body.dataset.mode = state.mode;
    var classroom = $("#mode-classroom");
    var games = $("#mode-games");
    if (classroom) {
      classroom.hidden = state.mode !== "classroom";
      classroom.inert = !!state.active;
    }
    if (games) {
      games.hidden = state.mode !== "games";
      games.inert = !!state.active;
    }
    document.body.classList.toggle("playing", !!state.active);
  }

  function render() {
    renderClassroom();
    renderGames();
    renderPlayer();
    syncChrome();
    closeDrawer();
  }

  function toggleMode() {
    state.mode = state.mode === "classroom" ? "games" : "classroom";
    render();
  }

  function toggleDone(id) {
    state.done[id] = !state.done[id];
    var button = playerEl && playerEl.querySelector('[data-action="mark-done"]');
    var status = playerEl && playerEl.querySelector("[data-turnin-status]");
    if (button) button.textContent = state.done[id] ? "Undo" : "Mark as done";
    if (status) {
      status.textContent = state.done[id] ? "Done" : "Assigned";
      status.classList.toggle("done", !!state.done[id]);
    }
    toast(state.done[id] ? "Marked as done." : "Marked as not done.");
  }

  function toggleFullscreen() {
    var target = (playerEl && playerEl.querySelector("[data-fs-target]")) || stageEl;
    if (!target) return;
    try {
      if (!document.fullscreenElement) {
        if (target.requestFullscreen) {
          var request = target.requestFullscreen();
          if (request && request.catch) request.catch(function () { toast("Fullscreen was blocked."); });
        } else {
          toast("Fullscreen is not available in this browser.");
        }
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (error) {
      toast("Fullscreen is not available here.");
    }
  }

  /* ----------------------------------------------------------
     drawer
     ---------------------------------------------------------- */
  function openDrawer() {
    if (drawerScrim) {
      drawerScrim.hidden = false;
      document.body.classList.add("drawer-open");
      var first = drawerScrim.querySelector(".gc-drawer-item");
      if (first) first.focus();
    }
  }

  function closeDrawer() {
    if (!drawerScrim) return;
    drawerScrim.hidden = true;
    document.body.classList.remove("drawer-open");
  }

  function drawerOpen() {
    return drawerScrim && !drawerScrim.hidden;
  }

  /* ----------------------------------------------------------
     events
     ---------------------------------------------------------- */
  function handleAction(action, element) {
    switch (action) {
      case "home":
        if (state.active) closePlayer();
        state.gc.classId = null;
        state.gc.tab = "stream";
        render();
        break;
      case "games-home":
        state.mk.query = "";
        state.mk.category = "All";
        if (searchEl) searchEl.value = "";
        if (state.active) closePlayer();
        render();
        break;
      case "toggle-mode":
        toggleMode();
        break;
      case "drawer":
        openDrawer();
        break;
      case "drawer-close":
        closeDrawer();
        break;
      case "join":
        toast("Ask your teacher for the class code.");
        break;
      case "account":
        toast("Signed in as " + ((META.student && META.student.name) || "Sam Carter") + ".");
        break;
      case "archived":
        toast("No archived classes.");
        break;
      case "open-class":
        state.gc.classId = element.getAttribute("data-id");
        state.gc.tab = "stream";
        if (state.active) closePlayer();
        render();
        break;
      case "tab":
        state.gc.tab = element.getAttribute("data-tab");
        renderClassroom();
        break;
      case "open-game":
      case "play":
        openGame(element.getAttribute("data-id"));
        break;
      case "close-player":
        closePlayer();
        break;
      case "mark-done":
        toggleDone(element.getAttribute("data-id"));
        break;
      case "fullscreen":
        toggleFullscreen();
        break;
      case "compose":
        toast("Only teachers can post announcements in this class.");
        break;
      case "filler":
        toast("This assignment has no attached activity.");
        break;
      case "calendar":
        closeDrawer();
        toast("No events scheduled this week.");
        break;
      case "todo":
        closeDrawer();
        toast("You're all caught up.");
        break;
      case "category":
        state.mk.category = element.getAttribute("data-cat");
        renderGames();
        break;
      case "clear-filters":
        state.mk.query = "";
        state.mk.category = "All";
        if (searchEl) searchEl.value = "";
        renderGames();
        break;
      default:
        break;
    }
  }

  function onClick(event) {
    var target = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!target) return;
    var action = target.getAttribute("data-action");

    if (action === "drawer-close" && event.target !== drawerScrim) return;
    if (event.target.closest && event.target.closest("a")) event.preventDefault();

    handleAction(action, target);
  }

  function onKeydown(event) {
    if (event.key === "Enter" && event.target && event.target.hasAttribute &&
        event.target.hasAttribute("data-private-comment")) {
      event.target.value = "";
      event.target.blur();
      toast("Private comment saved.");
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toggleMode();
      return;
    }

    if (event.key === "`" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (GameKit.isTyping(event.target)) return;
      event.preventDefault();
      toggleMode();
      return;
    }

    if (event.key === "Escape") {
      if (drawerOpen()) {
        closeDrawer();
      } else if (state.active) {
        closePlayer();
      } else if (state.mode === "classroom" && state.gc.classId) {
        state.gc.classId = null;
        state.gc.tab = "stream";
        render();
      } else if (state.mode === "games" && state.mk.query) {
        state.mk.query = "";
        if (searchEl) searchEl.value = "";
        renderGames();
        if (searchEl) searchEl.blur();
      } else if (searchEl && document.activeElement === searchEl) {
        searchEl.blur();
      }
      return;
    }

    if (event.key === "/" && state.mode === "games" && !GameKit.isTyping(event.target)) {
      event.preventDefault();
      if (searchEl) searchEl.focus();
    }
  }

  function onSearch() {
    state.mk.query = searchEl.value;
    renderGames();
  }

  function onBest(event) {
    if (!state.active || !event.detail || event.detail.id !== state.active) return;
    if (state.mode !== "games") return;
    var game = getGame(state.active);
    var best = playerEl && playerEl.querySelector("[data-best]");
    if (game && best) best.innerHTML = esc(game.scoreLabel) + ': <b>' + esc(bestText(game)) + "</b>";
  }

  function bind() {
    playerEl = $("#player");
    gcView = $("#gc-view");
    mkView = $("#mk-view");
    searchEl = $("#mk-search");
    drawerScrim = $("#drawer-scrim");

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("arcade:best", onBest);
    window.addEventListener("resize", fitStage);
    document.addEventListener("fullscreenchange", fitStage);
    if (searchEl) searchEl.addEventListener("input", onSearch);
  }

  function init() {
    bind();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
