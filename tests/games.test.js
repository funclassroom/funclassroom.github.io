/* The bundled games: start each one under jsdom with a stand-in canvas and
   make sure initialising it, clicking Start and pressing the keys does not
   throw. The real-browser check lives in .github/workflows/local-files.yml. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "assets/games");

let pass = 0;
let fail = 0;

function check(name, condition, extra) {
  if (condition) {
    pass += 1;
    console.log("  \x1b[32mPASS\x1b[0m  " + name);
  } else {
    fail += 1;
    console.log("  \x1b[31mFAIL\x1b[0m  " + name + (extra ? "  -> " + extra : ""));
  }
}

function ctxStub() {
  const noop = () => {};
  return new Proxy(
    {
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    },
    {
      get(target, key) {
        if (key in target) return target[key];
        return noop;
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    }
  );
}

function boot(file) {
  const html = fs.readFileSync(path.join(DIR, file), "utf8");
  const script = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    .map((m) => m[1])
    .join("\n");
  const dom = new JSDOM(html.replace(/<script>[\s\S]*?<\/script>/g, ""), {
    url: "https://example.test/games/" + file,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = function () {
    const ctx = ctxStub();
    ctx.canvas = this;
    return ctx;
  };
  window.requestAnimationFrame = () => 0;
  window.cancelAnimationFrame = () => {};
  window.localStorage.clear();

  const errors = [];
  window.addEventListener("error", (event) => errors.push(String(event.message)));
  try {
    window.eval(script);
  } catch (err) {
    errors.push(String(err && err.message ? err.message : err));
  }
  return { dom, window, errors };
}

function poke(window, errors) {
  ["[data-go]", "[data-new]", "[data-again]"].forEach((selector) => {
    const button = window.document.querySelector(selector);
    if (!button) return;
    try {
      button.click();
    } catch (err) {
      errors.push(selector + ": " + err.message);
    }
  });
  try {
    Array.from(window.document.querySelectorAll(".cell")).forEach((cell) => cell.click());
  } catch (err) {
    errors.push("cells: " + err.message);
  }
  ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", " ", "Enter", "p"].forEach((key) => {
    try {
      window.document.dispatchEvent(
        new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    } catch (err) {
      errors.push(key + ": " + err.message);
    }
  });
}

console.log("\nGAMES — the bundled files\n");

const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".html")).sort();
check("all seven games are present", files.length === 7, files.join(", "));

for (const file of files) {
  const { dom, window, errors } = boot(file);
  check(file + " starts without throwing", errors.length === 0, errors.slice(0, 2).join(" | "));

  poke(window, errors);
  check(file + " survives a start and some keys", errors.length === 0, errors.slice(0, 2).join(" | "));

  const canvas = window.document.querySelector("canvas#game");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    check(file + " has a canvas to draw on", !!ctx);
  }
  dom.window.close();
}

console.log("\n  GAMES: " + pass + " passed, " + fail + " failed\n");
if (fail) {
  console.log("Failures:\n  " + fail + " check(s) failed\n");
  process.exit(1);
}
