/* ============================================================
   CATALOG — the only file you need to edit to change the line-up.
   Every entry is one game + the classroom it hides behind.

   id          unique slug, must match Arcade.register({ id })
   title       real game name (games mode)
   tagline     one line shown on the card
   category    Arcade | Puzzle | Action | Sports
   tags        search keywords
   ratio       width / height of the play surface (number)
   art         card gradient + glyph (decorative, inline SVG)
   scoreType   "high" or "low"
   scoreLabel  label for the best-score chip
   scoreFormat "number" | "time" | "moves"
   controls    short controls hint
   game.class  the Classroom disguise
   ============================================================ */

window.GAME_CATALOG = [
  {
    id: "snake",
    title: "Snake",
    tagline: "Eat, grow, and keep your tail out of trouble.",
    category: "Arcade",
    tags: ["snake", "classic", "retro", "grow", "arcade"],
    ratio: 1,
    controls: "Arrow keys / WASD · swipe",
    scoreType: "high",
    scoreLabel: "Best score",
    scoreFormat: "number",
    art: {
      bg: "linear-gradient(145deg,#052e21 0%,#0b6b46 55%,#39d98a 100%)",
      fg: "#06231a",
      glyph:
        '<path d="M14 50c0-12 10-14 18-12 10 3 16-2 16-10 0-7-6-11-13-9" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>' +
        '<circle cx="35" cy="19" r="7" fill="currentColor"/><circle cx="37.5" cy="17" r="1.8" fill="#06231a"/>'
    },
    class: {
      subject: "Biology",
      section: "Period 1 · Lab B",
      teacher: "Ms. Rivera",
      email: "erivera@northfield.edu",
      assignment: "Lab 7 — Predator & Prey Simulation",
      due: "Friday, 11:59 PM",
      points: 20,
      color: "#188038",
      instructions: [
        "Run the simulation below for at least three minutes.",
        "Each item consumed counts as one unit of energy. Record your final length and best score.",
        "In one sentence, explain what limited the population from growing forever."
      ]
    }
  },
  {
    id: "breakout",
    title: "Brick Breaker",
    tagline: "Clear the wall with one very busy ball.",
    category: "Arcade",
    tags: ["breakout", "bricks", "paddle", "ball", "arcade", "classic"],
    ratio: 1.538,
    controls: "Mouse / finger · ← → · click to serve",
    scoreType: "high",
    scoreLabel: "Best score",
    scoreFormat: "number",
    art: {
      bg: "linear-gradient(145deg,#101a4d 0%,#2b4bff 55%,#7ce7ff 100%)",
      fg: "#eaf2ff",
      glyph:
        '<g fill="currentColor"><rect x="10" y="15" width="12" height="7" rx="2"/><rect x="26" y="15" width="12" height="7" rx="2"/>' +
        '<rect x="42" y="15" width="12" height="7" rx="2"/><rect x="18" y="26" width="12" height="7" rx="2"/>' +
        '<rect x="34" y="26" width="12" height="7" rx="2"/><rect x="10" y="37" width="12" height="7" rx="2"/>' +
        '<rect x="26" y="37" width="12" height="7" rx="2"/><rect x="42" y="37" width="12" height="7" rx="2"/>' +
        '<circle cx="30" cy="51" r="4"/><rect x="20" y="57" width="24" height="4" rx="2"/></g>'
    },
    class: {
      subject: "Physics",
      section: "Period 3 · Room 204",
      teacher: "Mr. Okafor",
      email: "dokafor@northfield.edu",
      assignment: "Unit 4 — Energy Transfer Practice",
      due: "Thursday, 8:00 AM",
      points: 15,
      color: "#1967d2",
      instructions: [
        "Play one full round of the activity below.",
        "Track how the ball's direction changes after each collision.",
        "Describe one place where kinetic energy was transferred rather than created."
      ]
    }
  },
  {
    id: "sky-dash",
    title: "Sky Dash",
    tagline: "One button, a lot of sky, and some very rude pipes.",
    category: "Action",
    tags: ["sky", "dash", "bird", "flappy", "one button", "action"],
    ratio: 1.538,
    controls: "Space / click / tap to flap",
    scoreType: "high",
    scoreLabel: "Best score",
    scoreFormat: "number",
    art: {
      bg: "linear-gradient(150deg,#0b2a5b 0%,#2f7dd1 45%,#ffb75e 100%)",
      fg: "#fff6e2",
      glyph:
        '<path d="M8 40c7-2 12-8 19-8 8 0 10 6 18 6 5 0 8-2 11-5-2 10-8 16-18 16-12 0-18-4-30-9z" fill="currentColor"/>' +
        '<path d="M30 33c2-8 9-12 17-10-3 4-5 8-6 13" fill="currentColor" opacity=".62"/>' +
        '<circle cx="43" cy="30" r="2.2" fill="#0b2a5b"/>'
    },
    class: {
      subject: "Physical Education",
      section: "Period 5 · Gym",
      teacher: "Coach Bennett",
      email: "jbennett@northfield.edu",
      assignment: "Fitness Log — Endurance Unit",
      due: "Monday, 9:00 AM",
      points: 10,
      color: "#e8710a",
      instructions: [
        "Complete three attempts of the activity below.",
        "Log your best distance marker and how many attempts it took.",
        "Compare steady effort with panic-tapping. Which lasted longer?"
      ]
    }
  },
  {
    id: "2048",
    title: "2048",
    tagline: "Slide, merge, repeat. Do not think about the number 4096.",
    category: "Puzzle",
    tags: ["2048", "numbers", "merge", "slide", "puzzle", "math"],
    ratio: 1.28,
    controls: "Arrow keys / WASD · swipe",
    scoreType: "high",
    scoreLabel: "Best score",
    scoreFormat: "number",
    art: {
      bg: "linear-gradient(145deg,#3b2410 0%,#bb6b1f 55%,#ffd76a 100%)",
      fg: "#fff8e8",
      glyph:
        '<g fill="currentColor"><rect x="12" y="12" width="18" height="18" rx="4"/><rect x="34" y="12" width="18" height="18" rx="4" opacity=".72"/>' +
        '<rect x="12" y="34" width="18" height="18" rx="4" opacity=".52"/><rect x="34" y="34" width="18" height="18" rx="4" opacity=".34"/></g>'
    },
    class: {
      subject: "Mathematics",
      section: "Period 2 · Room 112",
      teacher: "Ms. Alvarez",
      email: "malvarez@northfield.edu",
      assignment: "Unit 4 — Powers of Two Warm-Up",
      due: "Tomorrow, 8:00 AM",
      points: 5,
      color: "#8430ce",
      instructions: [
        "Play until you run out of moves or reach 2048.",
        "Write down the sequence of tile values you created along the way.",
        "Explain why every number on the board is a power of two."
      ]
    }
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    tagline: "Numbers, guesses, and the occasional small explosion.",
    category: "Puzzle",
    tags: ["minesweeper", "mines", "logic", "flags", "puzzle", "classic"],
    ratio: 1.28,
    controls: "Click to open · right-click to flag",
    scoreType: "low",
    scoreLabel: "Best time",
    scoreFormat: "time",
    art: {
      bg: "linear-gradient(145deg,#3a0b0b 0%,#a3231d 55%,#ff8a5c 100%)",
      fg: "#fff1ea",
      glyph:
        '<circle cx="32" cy="34" r="13" fill="currentColor"/>' +
        '<g stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M32 12v8M32 48v8M12 34h8M44 34h8M18 20l6 6M40 42l6 6M46 20l-6 6M24 42l-6 6"/></g>'
    },
    class: {
      subject: "Chemistry",
      section: "Period 6 · Lab C",
      teacher: "Dr. Whitfield",
      email: "awhitfield@northfield.edu",
      assignment: "Lab 3 — Periodic Trends Review",
      due: "Wednesday, 11:59 PM",
      points: 25,
      color: "#c5221f",
      instructions: [
        "Clear the board without setting off a reaction.",
        "Use the neighbouring counts to rule out options before guessing.",
        "Note the fastest time you achieved and how many flags you used."
      ]
    }
  },
  {
    id: "memory",
    title: "Memory Match",
    tagline: "Sixteen cards, eight pairs, one suspiciously good memory.",
    category: "Puzzle",
    tags: ["memory", "match", "pairs", "recall", "puzzle", "cards"],
    ratio: 1.28,
    controls: "Click / tap to flip",
    scoreType: "low",
    scoreLabel: "Fewest moves",
    scoreFormat: "moves",
    art: {
      bg: "linear-gradient(145deg,#052b2d 0%,#0e7772 55%,#7ef0d1 100%)",
      fg: "#ecfff9",
      glyph:
        '<rect x="10" y="16" width="20" height="32" rx="4" fill="currentColor"/>' +
        '<rect x="34" y="16" width="20" height="32" rx="4" fill="currentColor" opacity=".55"/>' +
        '<path d="M18 34l5 5 8-10" stroke="#0b3b3a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    class: {
      subject: "English Literature",
      section: "Period 4 · Room 210",
      teacher: "Ms. Chen",
      email: "lchen@northfield.edu",
      assignment: "Vocabulary — Week 8 Flashcards",
      due: "Friday, 8:00 AM",
      points: 10,
      color: "#007b83",
      instructions: [
        "Complete the matching activity at least twice.",
        "Record your fewest moves and the time it took.",
        "Pick two words and use each in a sentence about the novel."
      ]
    }
  },
  {
    id: "pong",
    title: "Paddle Duel",
    tagline: "The original sports game. First to seven.",
    category: "Sports",
    tags: ["pong", "paddle", "tennis", "table tennis", "sports", "classic"],
    ratio: 1.6,
    controls: "Mouse / finger · ↑ ↓",
    scoreType: "high",
    scoreLabel: "Best rally",
    scoreFormat: "number",
    art: {
      bg: "linear-gradient(145deg,#231047 0%,#5c2ecc 55%,#c9a7ff 100%)",
      fg: "#f4eeff",
      glyph:
        '<g fill="currentColor"><rect x="12" y="18" width="5" height="22" rx="2.5"/><rect x="47" y="28" width="5" height="22" rx="2.5"/>' +
        '<circle cx="35" cy="27" r="5"/></g><path d="M32 12v40" stroke="currentColor" stroke-width="2" stroke-dasharray="4 6" opacity=".4"/>'
    },
    class: {
      subject: "Computer Science",
      section: "Period 7 · Room 301",
      teacher: "Mr. Park",
      email: "jpark@northfield.edu",
      assignment: "Unit 2 — Event Loops & Collision",
      due: "Next Tuesday, 11:59 PM",
      points: 20,
      color: "#7627bb",
      instructions: [
        "Play a full match against the computer.",
        "Watch how input, position updates, and collisions happen every frame.",
        "Describe the game loop in three steps, using your own words."
      ]
    }
  }
];

/* ---------- the rest of the Classroom dressing ---------- */
window.CLASSROOM_META = {
  student: { name: "Sam Carter", initial: "S", email: "scarter@northfield.edu" },
  school: "Northfield High School",
  year: "2026–27",
  roster: [
    "Ava Patel", "Noah Brooks", "Mia Delgado", "Liam O'Connor",
    "Zoe Nakamura", "Ethan Cole", "Priya Raman", "Lucas Meyer",
    "Amara Osei", "Diego Santos"
  ],
  streamExtras: [
    "Reminder: bring a charged Chromebook on Thursday. We are using the lab carts.",
    "The study guide for this unit is posted under Classwork. Ask before Friday if anything is unclear.",
    "No food or drinks near the equipment, please. Yes, that includes the suspiciously large iced coffee."
  ],
  // Assigned to every class, in the order shown on the card grid.
  generalAnnouncements: [
    {
      author: "Northfield High School",
      initial: "N",
      color: "#5f6368",
      when: "Monday",
      text: "Semester 2 begins next week. Check the Classwork tab for the updated syllabus and room assignments."
    }
  ]
};
