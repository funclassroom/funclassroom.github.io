/* ============================================================
   MadKid Classroom  —  assets/js/app.js
   ------------------------------------------------------------
   Classroom mode navigation mirrors the real product:
     Classes grid  ->  Class page (Stream / Classwork / People)
                 ->  Assignment page (the game runs here)

   Games mode is the real library.  Ctrl+Shift+K (or ` ) flips
   between the two instantly.
   ============================================================ */
(function () {
  "use strict";

  var CATALOG = window.GAME_CATALOG || [];
  var META = window.CLASSROOM_META || {};
  var LS_CUSTOM = "mk.customGames.v1";
  var LS_MODE = "mk.mode.v1";

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2000);
  }
  function initial(name) {
    var n = String(name || "?").trim();
    return n ? n.charAt(0).toUpperCase() : "?";
  }
  function shade(hex) {
    var h = String(hex || "#1e8e3e").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return "#0b8043";
    var r = Math.max(0, ((n >> 16) & 255) - 45);
    var g = Math.max(0, ((n >> 8) & 255) - 45);
    var b = Math.max(0, (n & 255) - 45);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function banner(color) {
    return "background:linear-gradient(135deg," + esc(color) + "," + esc(shade(color)) + ")";
  }

  /* ---------- favicons (inline SVG) ---------- */
  var FAV_CLASSROOM = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" rx="6" fill="#1e8e3e"/>' +
    '<path d="M16 7 L27 12 L16 17 L5 12 Z" fill="#fff"/>' +
    '<path d="M9 14.6v4.1c0 2 3.1 3.6 7 3.6s7-1.6 7-3.6v-4.1l-7 3.2z" fill="#fff" opacity=".85"/></svg>');
  var FAV_GAMES = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" rx="6" fill="#7c5cff"/>' +
    '<rect x="6" y="11" width="20" height="12" rx="6" fill="#ffcc00"/>' +
    '<rect x="10" y="15.2" width="6" height="2" rx="1" fill="#1a1a1a"/>' +
    '<rect x="12" y="13.2" width="2" height="6" rx="1" fill="#1a1a1a"/>' +
    '<circle cx="21" cy="15.5" r="1.6" fill="#1a1a1a"/>' +
    '<circle cx="23.4" cy="19" r="1.6" fill="#1a1a1a"/></svg>');

  function setFavicon(mode) {
    var link = $("link[rel='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = mode === "classroom" ? FAV_CLASSROOM : FAV_GAMES;
  }

  /* ---------- catalogue ---------- */
  function loadCustom() {
    try { return JSON.parse(localStorage.getItem(LS_CUSTOM) || "[]"); } catch (e) { return []; }
  }
  function saveCustom(list) {
    try { localStorage.setItem(LS_CUSTOM, JSON.stringify(list)); } catch (e) {}
  }
  function allGames() {
    return CATALOG.concat(loadCustom()).filter(function (g) { return g && g.url; });
  }
  function findGame(id) {
    var l = allGames();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function cls(g) {
    return g["class"] || { subject: g.title, section: "", teacher: "", assignment: g.title, color: "#1e8e3e" };
  }

  /* ============================================================
     STATE
     ============================================================ */
  var currentMode = "classroom";
  var currentClassId = null;   // which game/class page is open (classroom mode)
  var currentTab = "stream";
  var activeGameId = null;     // which game iframe is mounted

  /* ============================================================
     MODE SWITCH
     ============================================================ */
  function setMode(mode, opts) {
    opts = opts || {};
    currentMode = mode;
    document.body.setAttribute("data-mode", mode);
    setFavicon(mode);
    closeDrawer();

    // tear down the host we are leaving: one live iframe at a time
    var leaving = mode === "classroom" ? $("#player-games") : $("#player-classroom");
    if (leaving) { leaving.innerHTML = ""; leaving.hidden = true; }

    var keep = activeGameId;
    if (mode === "classroom") {
      if (keep && findGame(keep)) { currentClassId = keep; }
      render();
      document.title = currentClassId ? cls(findGame(currentClassId)).subject : "Classes";
    } else {
      render();
      document.title = "MadKid Games — Play HTML5 Games";
    }

    if (!opts.silent) {
      try { localStorage.setItem(LS_MODE, mode); } catch (e) {}
      if (!opts.quiet) toast(mode === "classroom" ? "Switched to Classroom" : "Switched to Games");
    }
    scrollTop();
  }

  function toggleMode() { setMode(currentMode === "classroom" ? "games" : "classroom"); }

  /* ============================================================
     RENDER ROOT
     ============================================================ */
  function render() {
    if (currentMode === "classroom") { renderClassroom(); }
    else { renderGamesMode(); }
  }


  /* ---------- which player host belongs to the active mode ---------- */
  function playerRoot() {
    return currentMode === "classroom" ? $("#player-classroom") : $("#player-games");
  }

  function show(node) { if (node) node.hidden = false; }
  function hide(node) { if (node) node.hidden = true; }

  /* Hiding is not enough: the iframe keeps running (audio, timers, network)
     until it leaves the DOM. Always clear the host when we stop playing. */
  function scrollTop() { try { window.scrollTo(0, 0); } catch (e) {} }

  function clearPlayer(node) {
    if (!node) return;
    node.innerHTML = "";
    node.hidden = true;
  }

  /* ============================================================
     CLASSROOM MODE
     ============================================================ */
  function renderClassroom() {
    hide($("#games-browse"));
    clearPlayer($("#player-games"));
    var games = allGames();

    // Keep the top-level grid populated at every depth, so navigating back
    // is instant and the DOM never depends on which route you arrived by.
    renderClassesGrid(games);

    // ---- level 3: an assignment (game) is open ----
    if (activeGameId) {
      var g0 = findGame(activeGameId);
      if (g0) {
        hide($("#view-classes")); hide($("#view-class"));
        show(playerRoot()); renderAssignment(g0);
        return;
      }
      activeGameId = null;
    }

    // ---- level 2: inside a class ----
    if (currentClassId) {
      var g = findGame(currentClassId);
      if (g) {
        hide($("#view-classes")); show($("#view-class"));
        clearPlayer(playerRoot()); renderClassPage(g);
        return;
      }
      currentClassId = null;
    }

    // ---- level 1: the classes grid ----
    hide($("#view-class")); clearPlayer(playerRoot()); show($("#view-classes"));
    document.title = "Classes";
  }

  function renderClassesGrid(games) {
    var grid = $("#class-grid");
    grid.innerHTML = "";
    if (!games.length) {
      grid.appendChild(el("div", "empty",
        "No classes yet.<br><br>Switch to the Games view and use <b>+ Add game</b>."));
      return;
    }
    games.forEach(function (g) {
      var c = cls(g);
      var card = el("button", "class-card");
      card.type = "button";
      card.setAttribute("aria-label", c.subject);
      card.innerHTML =
        '<div class="class-banner" style="' + banner(c.color) + '">' +
          '<div><p class="class-title">' + esc(c.subject) + '</p>' +
          '<p class="class-section">' + esc(c.section || "") + '</p></div>' +
          '<div class="class-initial">' + esc(initial(c.teacher || c.subject)) + '</div>' +
        '</div>' +
        '<div class="class-body">' +
          '<div class="class-teacher">' + esc(c.teacher || "") + '</div>' +
          '<div class="class-hint">' + esc(c.assignment || "No work due") + '</div>' +
        '</div>' +
        '<div class="class-footer">' +
          '<span class="gc-icon-btn" role="img" aria-label="Class folder"><span class="mi">folder_open</span></span>' +
          '<span class="gc-icon-btn" role="img" aria-label="Class notebook"><span class="mi">menu_book</span></span>' +
        '</div>';
      card.addEventListener("click", function () { currentClassId = g.id; currentTab = "stream"; render(); scrollTop(); });
      grid.appendChild(card);
    });
  }

  function renderClassPage(g) {
    var c = cls(g);
    document.title = c.subject;

    $("#class-hero").setAttribute("style", banner(c.color));
    $("#class-hero").innerHTML =
      '<h1>' + esc(c.subject) + '</h1>' +
      '<p>' + esc(c.section || "") + '</p>' +
      '<div class="class-initial hero-initial">' + esc(initial(c.teacher || c.subject)) + '</div>';

    $$(".gc-tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === currentTab);
    });

    hide($("#panel-stream")); hide($("#panel-classwork")); hide($("#panel-people"));

    if (currentTab === "stream") {
      show($("#panel-stream"));
      renderStream(g, c);
    } else if (currentTab === "classwork") {
      show($("#panel-classwork"));
      renderClasswork(g, c);
    } else {
      show($("#panel-people"));
      renderPeople(c);
    }
  }

  function renderStream(g, c) {
    var feed = $("#stream-feed");
    feed.innerHTML = "";

    feed.appendChild(el("div", "composer",
      '<div class="post-avatar" style="background:#1967d2">' + esc(initial(META.accountName)) + '</div>' +
      '<span>Announce something to your class</span>'));

    // the assignment teaser -> opens the game
    var asg = el("div", "post post-assignment");
    asg.innerHTML =
      '<div class="post-head">' +
        '<div class="post-avatar" style="' + banner(c.color) + '"><span class="mi" style="color:#fff;font-size:18px">assignment</span></div>' +
        '<div class="post-meta"><strong>' + esc(c.teacher || "Teacher") + '</strong>' +
        '<small>Posted a new assignment: ' + esc(c.assignment || c.subject) + '</small></div>' +
        '<button class="gc-btn solid" data-open-game>Open</button>' +
      '</div>' +
      '<div class="post-body">Attached material · Due 11:59 PM</div>';
    asg.querySelector("[data-open-game]").addEventListener("click", function () { launchGame(g); });
    feed.appendChild(asg);

    feed.appendChild(buildNotice());

    (META.announcements || []).forEach(function (a) {
      feed.appendChild(el("div", "post",
        '<div class="post-head">' +
          '<div class="post-avatar" style="background:' + esc(a.color || "#1e8e3e") + '">' + esc(initial(a.author)) + '</div>' +
          '<div class="post-meta"><strong>' + esc(a.author) + '</strong><small>' + esc(a.time) + '</small></div>' +
        '</div><div class="post-body">' + esc(a.body) + '</div>'));
    });

    var side = $("#stream-side");
    side.innerHTML =
      '<div class="side-card"><h3>Upcoming</h3>' +
        '<div class="side-item side-clickable" data-open-game><strong>' + esc(c.assignment || c.subject) + '</strong>' +
        '<small>' + esc(c.subject) + '</small><em>Due tomorrow · 11:59 PM</em></div>' +
        (META.upcoming || []).map(function (u) {
          return '<div class="side-item"><strong>' + esc(u.title) + '</strong>' +
                 '<small>' + esc(u["class"]) + '</small><em>' + esc(u.due) + '</em></div>';
        }).join("") +
      '</div>';
    var sc = side.querySelector("[data-open-game]");
    if (sc) sc.addEventListener("click", function () { launchGame(g); });
  }

  function renderClasswork(g, c) {
    var wrap = $("#classwork-rows");
    wrap.innerHTML = "";
    wrap.appendChild(el("div", "topic-head", esc(c.assignment ? "Topic: " + c.subject : c.subject)));

    var row = el("button", "cw-row");
    row.type = "button";
    row.innerHTML =
      '<div class="cw-icon" style="' + banner(c.color) + '"><span class="mi">assignment</span></div>' +
      '<div><strong>' + esc(c.assignment || c.subject) + '</strong>' +
      '<small>Posted today · Due 11:59 PM · 100 points</small></div>' +
      '<div style="margin-left:auto;color:#9aa0a6;font-size:13px">100 pts</div>';
    row.addEventListener("click", function () { launchGame(g); });
    wrap.appendChild(row);

    // a few decorative extra rows
    ["Quiz — " + c.subject, "Reading — " + c.subject, "Review sheet — " + c.subject].forEach(function (t, i) {
      wrap.appendChild(el("div", "cw-row",
        '<div class="cw-icon" style="background:#9aa0a6"><span class="mi">' +
        (i === 0 ? "quiz" : i === 1 ? "menu_book" : "description") + '</span></div>' +
        '<div><strong>' + esc(t) + '</strong><small>Posted ' + (i + 2) + ' days ago</small></div>' +
        '<div style="margin-left:auto;color:#9aa0a6;font-size:13px">—</div>'));
    });
  }

  function renderPeople(c) {
    var wrap = $("#people-rows");
    wrap.innerHTML =
      '<div class="topic-head">Teachers</div>' +
      '<div class="cw-row"><div class="post-avatar" style="' + banner(c.color) + '">' + esc(initial(c.teacher)) + '</div>' +
      '<div><strong>' + esc(c.teacher || "Teacher") + '</strong><small>' + esc(c.teacher ? c.teacher.toLowerCase().replace(/[^a-z]+/g, ".") + "@school.edu" : "") + '</small></div></div>' +
      '<div class="topic-head">Students</div>' +
      ["Alex Morgan", "Priya Nair", "Jordan Lee", "Sam Okafor", "Riley Chen", "Diego Alvarez", "Noah Kim", "Zara Hussain"]
        .map(function (n, i) {
          return '<div class="cw-row"><div class="post-avatar" style="background:' +
            esc(["#1967d2", "#1e8e3e", "#a142f4", "#e8710a", "#d93025", "#12b5cb"][i % 6]) + '">' +
            esc(initial(n)) + '</div><div><strong>' + esc(n) + '</strong></div></div>';
        }).join("");
  }

  function buildNotice() {
    var p = el("div", "post notice-post");
    p.innerHTML =
      '<div class="post-head">' +
        '<div class="post-avatar" style="background:#f29900"><span class="mi" style="font-size:18px;color:#fff">gavel</span></div>' +
        '<div class="post-meta"><strong>Site Administrator</strong><small>Pinned announcement</small></div>' +
      '</div>' +
      '<p class="post-title">Official Notice Regarding Network Filtering Software</p>' +
      '<div class="post-body">' +
        'This page is a personal educational project. If a third-party filtering product ' +
        '(including, but not limited to, <b>Securly</b>) blocks, flags, or otherwise interferes ' +
        'with access to this website, the operator of said product hereby owes the site owner ' +
        '<b>one (1) unpaid debt</b>, payable immediately, and may be subject to <b>legal action</b>, ' +
        'stern emails, and/or a strongly worded letter from a parent.' +
        '<ul>' +
          '<li>Blocking this site constitutes a breach of the Unofficial Treaty of the Browser Tab.</li>' +
          '<li>Damages are calculated per blocked minute, and they compound.</li>' +
          '<li>This notice is self-executing and requires no signature, notary, or court filing.</li>' +
        '</ul>' +
        '<span class="notice-tag">Satire · not legal advice · do your homework anyway</span>' +
      '</div>';
    return p;
  }

  /* ---- assignment page: the game, classroom-skinned ---- */
  function renderAssignment(g) {
    var c = cls(g);
    document.title = c.assignment || c.subject;
    var root = playerRoot();
    root.innerHTML =
      '<div class="back-row">' +
        '<button class="gc-btn" data-act="back"><span class="mi">arrow_back</span> ' + esc(c.subject) + '</button>' +
      '</div>' +
      '<div class="asg-banner" style="' + banner(c.color) + '">' +
        '<h2>' + esc(c.assignment || c.subject) + '</h2>' +
        '<p>' + esc(c.teacher || "") + ' · Posted today · Due 11:59 PM · 100 points</p>' +
      '</div>' +
      '<div class="game-frame-card">' +
        '<div class="game-frame-head">' +
          '<div class="cw-icon" style="' + banner(c.color) + '"><span class="mi">description</span></div>' +
          '<div class="grow"><strong>' + esc(c.assignment || c.subject) + '</strong>' +
          '<small>Attached by ' + esc(c.teacher || "teacher") + ' · Your work is saved automatically</small></div>' +
          '<button class="gc-btn" data-act="reload" title="Reload"><span class="mi">refresh</span></button>' +
          '<button class="gc-btn" data-act="tab" title="Open in a new tab"><span class="mi">open_in_new</span></button>' +
          '<button class="gc-btn" data-act="full" title="Fullscreen"><span class="mi">fullscreen</span></button>' +
        '</div>' +
        '<div class="frame-shell"></div>' +
      '</div>';
    mountFrame(g);
  }

  function launchGame(g) { activeGameId = g.id; currentClassId = g.id; render(); scrollTop(); }

  /* ============================================================
     GAMES MODE
     ============================================================ */
  var filter = "All";
  var query = "";

  function categories() {
    var set = {};
    allGames().forEach(function (g) { if (g.category) set[g.category] = 1; });
    return ["All"].concat(Object.keys(set).sort());
  }

  function renderGamesMode() {
    hide($("#view-classes")); hide($("#view-class"));
    clearPlayer($("#player-classroom"));

    // Always keep the library grid populated, even while a game is open.
    // It is hidden, but this makes "Library" back-navigation instant and
    // keeps the DOM consistent whichever way you arrive in this mode.
    renderGamesBrowse();

    if (activeGameId) {
      var g = findGame(activeGameId);
      if (g) { hide($("#games-browse")); show(playerRoot()); renderGamesPlayer(g); return; }
      activeGameId = null;
    }
    clearPlayer(playerRoot());
    show($("#games-browse"));
  }

  function renderGamesBrowse() {
    var chips = $("#chips");
    chips.innerHTML = "";
    categories().forEach(function (cat) {
      var b = el("button", "chip" + (cat === filter ? " active" : ""), esc(cat));
      b.type = "button";
      b.addEventListener("click", function () { filter = cat; renderGamesBrowse(); });
      chips.appendChild(b);
    });

    var grid = $("#game-grid");
    var q = query.trim().toLowerCase();
    var list = allGames().filter(function (g) {
      if (filter !== "All" && g.category !== filter) return false;
      if (!q) return true;
      return ((g.title || "") + " " + (g.category || "") + " " + (g.tags || []).join(" ")).toLowerCase().indexOf(q) !== -1;
    });

    grid.innerHTML = "";
    if (!list.length) {
      grid.appendChild(el("div", "empty",
        'Nothing found.<br><br>Use <b>+ Add game</b> to paste in a URL from ' +
        '<a href="https://www.madkidgames.com/html5-games" target="_blank" rel="noopener" ' +
        'style="color:#ffcc00">madkidgames.com/html5-games</a>.'));
      return;
    }

    list.forEach(function (g) {
      var c = cls(g);
      var card = el("button", "game-card");
      card.type = "button";
      var thumb = g.thumb
        ? '<div class="game-thumb"><img src="' + esc(g.thumb) + '" alt="" loading="lazy"></div>'
        : '<div class="game-thumb" style="' + banner(c.color) + '">' + esc(initial(g.title)) + '</div>';
      card.innerHTML = thumb +
        '<div class="game-info"><strong>' + esc(g.title) + '</strong>' +
        '<small>' + esc(g.category || "Game") + '</small></div>';
      card.addEventListener("click", function () { activeGameId = g.id; render(); scrollTop(); });
      grid.appendChild(card);
    });
  }

  function renderGamesPlayer(g) {
    var root = playerRoot();
    root.innerHTML =
      '<div class="mk-player-head">' +
        '<button class="mk-btn" data-act="back"><span class="mi">arrow_back</span> Library</button>' +
        '<div class="grow"><strong>' + esc(g.title) + '</strong>' +
        '<small style="color:var(--mk-muted);margin-left:8px">' + esc(g.category || "") + '</small></div>' +
        '<button class="mk-btn accent" data-act="panic"><span class="mi">visibility_off</span> Hide — Ctrl+Shift+K</button>' +
        '<button class="mk-btn" data-act="reload" title="Reload"><span class="mi">refresh</span></button>' +
        '<button class="mk-btn" data-act="tab" title="Open in a new tab"><span class="mi">open_in_new</span></button>' +
        '<button class="mk-btn" data-act="full" title="Fullscreen"><span class="mi">fullscreen</span></button>' +
      '</div>' +
      '<div class="mk-frame-card"><div class="frame-shell"></div></div>';
    mountFrame(g);
  }

  function mountFrame(g) {
    var shell = playerRoot() && playerRoot().querySelector(".frame-shell");
    if (!shell) return;
    shell.innerHTML = "";
    var f = document.createElement("iframe");
    f.src = g.url;
    f.title = g.title;
    f.allow = "autoplay; fullscreen; gamepad; accelerometer; gyroscope; clipboard-write";
    f.allowFullscreen = true;
    f.setAttribute("loading", "lazy");
    f.setAttribute("referrerpolicy", "no-referrer");
    shell.appendChild(f);

    // A blocked iframe (X-Frame-Options / CSP frame-ancestors) fires no usable
    // error cross-origin, so fall back to a timer: if nothing has loaded in
    // 8s, surface an explanation instead of leaving a black rectangle.
    var loaded = false;
    f.addEventListener("load", function () { loaded = true; });
    clearTimeout(mountFrame._t);
    mountFrame._t = setTimeout(function () {
      if (loaded || !document.body.contains(f)) return;
      var warn = el("div", "frame-warn",
        '<span class="mi">error_outline</span>' +
        '<div><strong>This game may not allow embedding.</strong>' +
        '<small>The site it loads from can refuse to be shown inside a frame. ' +
        'Use <b>Open in a new tab</b>, or point this entry at the game\'s ' +
        'direct embed/iframe URL.</small></div>');
      shell.appendChild(warn);
    }, 8000);
  }

  /* ============================================================
     DRAWER (classroom hamburger)
     ============================================================ */
  function openDrawer() { $("#drawer-back").classList.add("open"); }
  function closeDrawer() { var d = $("#drawer-back"); if (d) d.classList.remove("open"); }

  /* ============================================================
     ADD-GAME MODAL
     ============================================================ */
  function openModal() {
    $("#modal-back").classList.add("open");
    $("#f-url").value = ""; $("#f-title").value = "";
    $("#f-thumb").value = ""; $("#f-subject").value = "";
    $("#f-teacher").value = ""; $("#f-section").value = "Period 1";
    $("#f-cat").value = "Arcade"; $("#f-color").value = "#1e8e3e";
    setTimeout(function () { $("#f-url").focus(); }, 40);
  }
  function closeModal() { $("#modal-back").classList.remove("open"); }

  /* Fallback disguise subjects, by category. Used when the add-game form
     leaves the subject blank — we must NOT fall back to the real game
     title, or the Classroom view would leak what it is hiding. */
  var SUBJECT_BY_CATEGORY = {
    Arcade: "Mathematics", Puzzle: "Computer Science", Racing: "Physical Education",
    Action: "English Language Arts", Sports: "Physical Education",
    Platformer: "Chemistry", Idle: "Economics", Strategy: "World History",
    Shooter: "Physics", Other: "Study Hall"
  };
  var TEACHERS = ["Mr. Anderson", "Ms. Rivera", "Dr. Whitfield", "Mrs. Callahan",
                  "Mr. Okafor", "Ms. Patel", "Coach Bennett", "Mr. Delgado"];

  function submitModal() {
    var url = $("#f-url").value.trim();
    if (!/^https?:\/\//i.test(url)) { toast("Paste a full URL starting with http:// or https://"); return; }
    var title = $("#f-title").value.trim() ||
      url.replace(/^https?:\/\//, "").split("/").filter(Boolean).pop() || "Untitled game";
    var cat = $("#f-cat").value || "Other";
    var list = loadCustom();

    var subject = $("#f-subject").value.trim() || SUBJECT_BY_CATEGORY[cat] || "Study Hall";
    var teacher = $("#f-teacher").value.trim() || TEACHERS[list.length % TEACHERS.length];

    list.push({
      id: "custom-" + Date.now().toString(36),
      title: title,
      url: url,
      thumb: $("#f-thumb").value.trim(),
      category: cat,
      tags: [title.toLowerCase()],
      "class": {
        subject: subject,
        section: $("#f-section").value.trim() || "Period " + ((list.length % 8) + 1),
        teacher: teacher,
        // deliberately built from the SUBJECT, never from the game title
        assignment: subject + " — Classwork Set " + (list.length + 1),
        color: $("#f-color").value || "#1e8e3e"
      }
    });
    saveCustom(list);
    closeModal();
    toast('Added "' + title + '"');
    render();
  }

  /* ============================================================
     WIRING
     ============================================================ */
  function init() {
    var acc = $("#gc-account");
    if (acc) {
      acc.textContent = initial(META.accountName);
      acc.title = (META.accountName || "") + (META.accountEmail ? " · " + META.accountEmail : "");
    }

    $$("[data-toggle-mode]").forEach(function (b) { b.addEventListener("click", toggleMode); });
    $$("[data-go-home]").forEach(function (b) {
      b.addEventListener("click", function () {
        currentClassId = null; activeGameId = null;
        if (currentMode !== "classroom") setMode("classroom"); else render();
      });
    });

    var hb = $("#gc-menu"); if (hb) hb.addEventListener("click", openDrawer);
    var db = $("#drawer-back"); if (db) db.addEventListener("click", function (e) { if (e.target === db) closeDrawer(); });
    $$("[data-drawer-home]").forEach(function (b) {
      b.addEventListener("click", function () { currentClassId = null; activeGameId = null; closeDrawer(); render(); });
    });

    $$(".gc-tab").forEach(function (t) {
      t.addEventListener("click", function () {
        activeGameId = null;                       // leave the assignment
        currentTab = t.getAttribute("data-tab");
        render();
        scrollTop();
      });
    });

    var addBtn = $("#mk-add"); if (addBtn) addBtn.addEventListener("click", openModal);
    var gcAdd = $("#gc-add"); if (gcAdd) gcAdd.addEventListener("click", openModal);
    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-save").addEventListener("click", submitModal);
    $("#modal-back").addEventListener("click", function (e) { if (e.target === this) closeModal(); });

    var search = $("#mk-search");
    if (search) search.addEventListener("input", function (e) { query = e.target.value; renderGamesBrowse(); });

    // delegated player actions
    $$(".player-root").forEach(function (pr) { pr.addEventListener("click", onPlayerAction); });

    initHotkeys();
  }

  function onPlayerAction(e) {
      var btn = e.target.closest ? e.target.closest("[data-act]") : null;
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "back") { activeGameId = null; render(); }
      if (act === "reload") { var g = findGame(activeGameId); if (g) mountFrame(g); }
      if (act === "full") {
        var s = playerRoot() && playerRoot().querySelector(".frame-shell");
        if (s && s.requestFullscreen) s.requestFullscreen();
      }
      if (act === "panic") setMode("classroom");
      if (act === "tab") {
        var tg = findGame(activeGameId);
        if (tg) window.open(tg.url, "_blank", "noopener,noreferrer");
      }
  }

  function initHotkeys() {
    document.addEventListener("keydown", function (e) {
      var t = e.target || {};
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "");
      if (e.ctrlKey && e.shiftKey && (e.key === "K" || e.key === "k")) {
        e.preventDefault(); toggleMode(); return;
      }
      if (!typing && (e.key === "`" || e.key === "~")) { e.preventDefault(); toggleMode(); return; }
      if (!typing && e.key === "Escape") {
        if ($("#modal-back").classList.contains("open")) { closeModal(); return; }
        if (activeGameId) { activeGameId = null; render(); return; }
        if (currentMode === "classroom" && currentClassId) { currentClassId = null; render(); }
      }
    });

    var saved = null;
    try { saved = localStorage.getItem(LS_MODE); } catch (err) {}
    // Default to CLASSROOM on a fresh visit so the first paint is the disguise.
    setMode(saved === "games" ? "games" : "classroom", { silent: true, quiet: true });
  }

  window.MK = {
    setMode: setMode, toggleMode: toggleMode,
    openGame: launchGame, saveCustom: saveCustom
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
