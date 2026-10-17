/* ============================================================
   GAME CATALOG  —  assets/js/games.js
   ============================================================
   This is the ONLY file you need to edit to add games.

   IMPORTANT: I could not reach madkidgames.com from the build
   sandbox, so the `url` values below are PLACEHOLDERS.
   Replace them with your real game URLs, e.g.:

     https://www.madkidgames.com/html5-games/<your-game>/
     https://www.madkidgames.com/html5-games/<your-game>/index.html

   Each entry:
     id        : unique slug (no spaces)
     title     : real game name (shown in Games mode)
     url       : page/iframe that runs the game
     thumb     : image URL for the card (blank "" = auto letter tile)
     category  : used for filter chips
     tags      : search keywords
     class     : the DISGUISE data used in Classroom mode
                 subject    -> shown as the class name
                 section    -> shown under the subject
                 teacher    -> shown on the card footer
                 assignment -> shown above the game when opened
                 color      -> banner colour of the class card
   ============================================================ */

window.GAME_CATALOG = [
  {
    id: "example-arcade-1",
    title: "Example Arcade Game",
    url: "https://www.madkidgames.com/html5-games/example-arcade-1/",
    thumb: "",
    category: "Arcade",
    tags: ["example", "arcade"],
    class: {
      subject: "Mathematics",
      section: "Period 3 · Room 204",
      teacher: "Mr. Anderson",
      assignment: "Unit 4 — Practice Set (Due Friday)",
      color: "#1e8e3e"
    }
  },
  {
    id: "example-puzzle-1",
    title: "Example Puzzle Game",
    url: "https://www.madkidgames.com/html5-games/example-puzzle-1/",
    thumb: "",
    category: "Puzzle",
    tags: ["example", "puzzle", "brain"],
    class: {
      subject: "Biology",
      section: "Period 1 · Lab B",
      teacher: "Ms. Rivera",
      assignment: "Lab 7 — Cell Structure Worksheet",
      color: "#0b8043"
    }
  },
  {
    id: "example-racing-1",
    title: "Example Racing Game",
    url: "https://www.madkidgames.com/html5-games/example-racing-1/",
    thumb: "",
    category: "Racing",
    tags: ["example", "racing", "cars"],
    class: {
      subject: "World History",
      section: "Period 5 · Room 118",
      teacher: "Dr. Whitfield",
      assignment: "Chapter 12 Reading & Questions",
      color: "#e8710a"
    }
  },
  {
    id: "example-shooter-1",
    title: "Example Shooter Game",
    url: "https://www.madkidgames.com/html5-games/example-shooter-1/",
    thumb: "",
    category: "Action",
    tags: ["example", "action", "shooter"],
    class: {
      subject: "English Language Arts",
      section: "Period 2 · Room 301",
      teacher: "Mrs. Callahan",
      assignment: "Essay Draft — Persuasive Writing",
      color: "#1967d2"
    }
  },
  {
    id: "example-sports-1",
    title: "Example Sports Game",
    url: "https://www.madkidgames.com/html5-games/example-sports-1/",
    thumb: "",
    category: "Sports",
    tags: ["example", "sports", "football"],
    class: {
      subject: "Physical Education",
      section: "Period 7 · Gymnasium",
      teacher: "Coach Bennett",
      assignment: "Fitness Log — Week 6",
      color: "#a142f4"
    }
  },
  {
    id: "example-platformer-1",
    title: "Example Platformer",
    url: "https://www.madkidgames.com/html5-games/example-platformer-1/",
    thumb: "",
    category: "Platformer",
    tags: ["example", "platformer", "jump"],
    class: {
      subject: "Chemistry",
      section: "Period 4 · Lab A",
      teacher: "Mr. Okafor",
      assignment: "Homework 9 — Balancing Equations",
      color: "#d93025"
    }
  },
  {
    id: "example-idle-1",
    title: "Example Idle / Clicker",
    url: "https://www.madkidgames.com/html5-games/example-idle-1/",
    thumb: "",
    category: "Idle",
    tags: ["example", "idle", "clicker"],
    class: {
      subject: "Computer Science",
      section: "Period 6 · Room 210",
      teacher: "Ms. Patel",
      assignment: "Project 3 — Loops & Conditionals",
      color: "#12b5cb"
    }
  },
  {
    id: "example-strategy-1",
    title: "Example Strategy Game",
    url: "https://www.madkidgames.com/html5-games/example-strategy-1/",
    thumb: "",
    category: "Strategy",
    tags: ["example", "strategy", "tactics"],
    class: {
      subject: "Government & Economics",
      section: "Period 8 · Room 112",
      teacher: "Mr. Delgado",
      assignment: "Case Study — Market Structures",
      color: "#f29900"
    }
  }
];

/* ------------------------------------------------------------
   CLASSROOM "STREAM" CONTENT
   Decorative announcements shown in Classroom mode so the page
   looks lived-in. Edit freely.
   ------------------------------------------------------------ */
window.CLASSROOM_META = {
  schoolName: "Classroom",
  accountName: "Student",
  accountInitial: "S",
  accountEmail: "student@school.edu",
  hotkey: "Ctrl+Shift+K",
  announcements: [
    {
      author: "Mr. Anderson",
      initial: "A",
      color: "#1e8e3e",
      time: "Today at 9:14 AM",
      body: "Reminder: Unit 4 practice set is due Friday at 11:59 PM. Late submissions lose 10% per day."
    },
    {
      author: "Ms. Patel",
      initial: "P",
      color: "#12b5cb",
      time: "Yesterday at 2:40 PM",
      body: "Great work on Project 2. We will begin loops and conditionals on Monday — bring your laptops."
    },
    {
      author: "Mrs. Callahan",
      initial: "C",
      color: "#1967d2",
      time: "Oct 12 at 8:05 AM",
      body: "Essay drafts are returned with comments. Please review the rubric before revising."
    }
  ],
  upcoming: [
    { title: "Unit 4 Practice Set", class: "Mathematics", due: "Due Fri, Oct 23" },
    { title: "Lab 7 Worksheet", class: "Biology", due: "Due Mon, Oct 26" },
    { title: "Essay Final Draft", class: "English Language Arts", due: "Due Wed, Oct 28" }
  ]
};
