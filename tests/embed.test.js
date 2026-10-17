const fs=require("fs"),{JSDOM}=require("jsdom");
const path=require("path");
const R=path.join(__dirname,"..");
const html=fs.readFileSync(R+"/embed.html","utf8");
let pass=0,fail=0;
const ok=(n,c,e)=>{c?(pass++,console.log("  \x1b[32mPASS\x1b[0m  "+n)):(fail++,console.log("  \x1b[31mFAIL\x1b[0m  "+n+(e?"  -> "+e:"")))};

function run(qs){
  const d=new JSDOM(html,{url:"http://localhost:8000/embed.html"+qs,runScripts:"dangerously",pretendToBeVisual:true});
  d.window.eval(fs.readFileSync(R+"/assets/js/games.js","utf8"));
  // re-fire DOMContentLoaded so the inline boot() sees the catalog
  d.window.document.dispatchEvent(new d.window.Event("DOMContentLoaded",{bubbles:true}));
  const f=d.window.document.querySelector("#stage iframe");
  const err=d.window.document.querySelector(".err");
  return {src:f&&f.src,title:d.window.document.title,err:err&&err.querySelector("h1").textContent};
}

console.log("\n=== embed.html ===");
let r=run("?game=example-racing-1");
ok("catalog id resolves to its URL", r.src==="https://www.madkidgames.com/html5-games/example-racing-1/", r.src);
ok("title set from the catalog", r.title==="Example Racing Game", r.title);
ok("no error shown", !r.err, r.err);

r=run("?src=https://www.madkidgames.com/html5-games/foo/&title=Foo");
ok("allowed host via ?src works", r.src==="https://www.madkidgames.com/html5-games/foo/", r.src);

r=run("?src=https://evil.example.com/game/");
ok("DISALLOWED host is refused", !r.src && !!r.err, r.err);
ok("refusal message explains why", (r.err||"").toLowerCase().includes("not allowed"), r.err);

r=run("?src=javascript:alert(1)");
ok("javascript: scheme refused", !r.src && !!r.err, r.src||r.err);

r=run("?game=does-not-exist");
ok("unknown id shows a helpful error", !r.src && /unknown game/i.test(r.err||""), r.err);

r=run("");
ok("missing params shows a helpful error", !r.src && /no game specified/i.test(r.err||""), r.err);

console.log("\n"+pass+" passed, "+fail+" failed\n");
process.exit(fail?1:0);
