/**
 * Checks the site can survive being published.
 *
 * Every rule here exists because something actually broke once, either on
 * the live site or while this one was being written. Node's standard
 * library only: the project has no dependencies and this must not add any.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SITE = join(ROOT, "site");
const PAGES = ["index.html", "faq.html", "404.html"];

const problems = [];
function fail(file, message) {
  problems.push({ file, message });
}

/* ---------------------------------------------------------------------
   Every file of the site, spelled exactly as it is on disk.

   Membership is tested against this list rather than asking the file
   system, because Windows would answer yes to `Team/Thiago.webp` and the
   Linux container it is deployed on would answer no.
   --------------------------------------------------------------------- */

function walk(dir, out = new Set()) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.add(relative(SITE, full).split("\\").join("/"));
  }
  return out;
}

const FILES = walk(SITE);

/* ---------------------------------------------------------------------
   What counts as a reference to a file of our own.
   --------------------------------------------------------------------- */

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const ASSET = /\.(?:css|js|mjs|png|jpe?g|webp|svg|ico|mp4|webm|woff2?|webmanifest|html|txt|xml)$/i;

function isLocalPath(value) {
  if (!value || value.startsWith("#") || EXTERNAL.test(value)) return false;
  return true;
}

function resolveRef(value) {
  const path = value.split("#")[0].split("?")[0];
  if (!path) return null;
  return posix.normalize(path.replace(/^\.?\//, ""));
}

/* ---------------------------------------------------------------------
   Read every page once and keep what the checks need.
   --------------------------------------------------------------------- */

const pages = new Map();

for (const name of PAGES) {
  const html = readFileSync(join(SITE, name), "utf8");
  const ids = [];
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.push(m[1]);
  pages.set(name, { html, ids, idSet: new Set(ids) });
}

/* ---------------------------------------------------------------------
   1. Nothing points at a file that is not there, or is there under a
      different spelling.
   --------------------------------------------------------------------- */

function checkRefs(file, text, attrs) {
  for (const m of text.matchAll(attrs)) {
    const value = m[2].trim();
    if (!isLocalPath(value)) continue;
    const path = resolveRef(value);
    if (!path || !ASSET.test(path)) continue;
    if (!FILES.has(path)) fail(file, `points at a file that is not there: ${value}`);
    else referenced.add(path);
  }
}

const referenced = new Set();

const HTML_ATTRS = /\b(href|src|poster|content)="([^"]*)"/g;
const CSS_URLS = /\b()url\(["']?([^"')]+)["']?\)/g;

for (const [name, page] of pages) checkRefs(name, page.html, HTML_ATTRS);

for (const css of [...FILES].filter((f) => f.endsWith(".css"))) {
  const text = readFileSync(join(SITE, css), "utf8");
  for (const m of text.matchAll(CSS_URLS)) {
    const value = m[2].trim();
    if (!isLocalPath(value)) continue;
    const path = posix.normalize(posix.join(posix.dirname(css), value.split("#")[0]));
    if (!FILES.has(path)) fail(css, `points at a file that is not there: ${value}`);
    else referenced.add(path);
  }
}

/* ---------------------------------------------------------------------
   2. Every in-page link lands on something.

      A menu entry that scrolls nowhere looks like a dead site, and the
      failure is silent: no error, no 404, just nothing happening.
   --------------------------------------------------------------------- */

for (const [name, page] of pages) {
  for (const m of page.html.matchAll(/href="([^"]*#[^"]*)"/g)) {
    const value = m[1];
    if (EXTERNAL.test(value)) continue;
    const [file, hash] = value.split("#");
    if (!hash || hash === "top") continue;
    const target = file ? resolveRef(file) : name;
    const dest = pages.get(target);
    if (!dest) continue; // a page outside this check; the file check covers it
    if (!dest.idSet.has(hash)) fail(name, `links to #${hash}, which does not exist in ${target}`);
  }
}

/* ---------------------------------------------------------------------
   3. No identifier is used twice in the same document.

      This is the defect the live site has: the two "How it works"
      layouts embed the same diagrams, so `url(#id)` resolves against the
      copy the CSS hides, and a pattern inside a subtree that is never
      rendered paints nothing. On phones the grid disappears.
   --------------------------------------------------------------------- */

for (const [name, page] of pages) {
  const seen = new Set();
  for (const id of page.ids) {
    if (seen.has(id)) fail(name, `uses the id "${id}" more than once`);
    seen.add(id);
  }
}

/* ---------------------------------------------------------------------
   4. No link opens a new tab.

      A new tab starts with no history, so its back button is dead and
      the visitor has no way back to the site.
   --------------------------------------------------------------------- */

for (const [name, page] of pages) {
  if (/target="_blank"/.test(page.html)) fail(name, `has a link with target="_blank"`);
}

/* ---------------------------------------------------------------------
   5. The five questions on the home page still match faq.html.

      They are a copy of five of the thirteen. Editing one and forgetting
      the other is the easiest mistake this repository offers.
   --------------------------------------------------------------------- */

const faq = pages.get("faq.html").html;
const home = pages.get("index.html").html;

function questionsIn(html) {
  const found = [];
  for (const m of html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)) {
    const text = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (text) found.push(text);
  }
  return found;
}

const faqQuestions = new Set(questionsIn(faq));
for (const q of questionsIn(home)) {
  if (!faqQuestions.has(q)) fail("index.html", `asks "${q}", which is not in faq.html`);
}

/* ---------------------------------------------------------------------
   6. Everything the site asks for is actually in the image.

      The Dockerfile names what gets copied, one piece at a time, instead
      of copying the folder and deleting the rest. That only holds as long
      as the list keeps up with the site, so the list is read back here
      and compared against what the pages reference.
   --------------------------------------------------------------------- */

// Files nothing links to, which still have to be there: robots points at
// the sitemap, and the pages themselves are what the visitor asks for.
const ALWAYS = [...PAGES, "robots.txt", "sitemap.xml"];

const dockerfile = readFileSync(join(ROOT, "Dockerfile"), "utf8").replace(/\\r?\n/g, " ");
const served = new Set();

for (const line of dockerfile.split(/\r?\n/)) {
  const m = line.match(/^\s*COPY\s+(.+)$/i);
  if (!m) continue;
  const parts = m[1].trim().split(/\s+/);
  const dest = parts.pop();
  if (!dest.startsWith("/srv")) continue; // the Caddyfile goes elsewhere
  for (const src of parts) {
    if (src === "." || src === "./" || src === "*") {
      fail("Dockerfile", "copies the whole folder into the image; name the pieces instead");
      continue;
    }
    const clean = src.replace(/^\.?\//, "").replace(/\/$/, "");
    if (clean === "site") {
      for (const f of FILES) served.add(f);
      continue;
    }
    if (!clean.startsWith("site/")) continue; // not part of the site
    const inside = clean.slice("site/".length);
    if (FILES.has(inside)) served.add(inside);
    else for (const f of FILES) if (f.startsWith(inside + "/")) served.add(f);
  }
}

for (const path of [...referenced, ...ALWAYS]) {
  if (!served.has(path)) fail("Dockerfile", `does not copy ${path}, which the site needs`);
}

/* ---------------------------------------------------------------------
   7. The two hosts are told the same thing.

      Cloudflare reads site/_headers; Caddy reads the Caddyfile. The same
      policy written twice in two syntaxes is the kind of thing that drifts
      quietly, and the half that drifts is the half nobody is looking at.
   --------------------------------------------------------------------- */

const headersFile = readFileSync(join(SITE, "_headers"), "utf8");
const caddyfile = readFileSync(join(ROOT, "Caddyfile"), "utf8");

const squash = (v) => v.trim().replace(/\s+/g, " ");

// site/_headers: a path, then indented "Header: value" lines under it.
const fromHeaders = new Map(); // "path\u0000Header" -> value
{
  let path = null;
  for (const raw of headersFile.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      path = line.trim();
      continue;
    }
    const m = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (m && path) fromHeaders.set(path + "\u0000" + m[1], squash(m[2]));
  }
}

// Caddyfile: one `header { ... }` block for everything, plus named path
// matchers with a Cache-Control line each.
const fromCaddy = new Map();
{
  // Walked line by line rather than matched as a block: the Caddyfile is
  // edited on Windows and checked on Linux, so the line endings differ.
  let inHeaderBlock = false;
  const matchers = new Map(); // @name -> [paths]

  for (const raw of caddyfile.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const bare = line.trim();

    if (bare === "header {") {
      inHeaderBlock = true;
      continue;
    }
    if (inHeaderBlock) {
      if (bare === "}") inHeaderBlock = false;
      else {
        const m = line.match(/^\s*([A-Za-z-]+)\s+"(.*)"$/);
        if (m) fromCaddy.set("/*\u0000" + m[1], squash(m[2]));
      }
      continue;
    }

    const def = line.match(/^\s*@(\w+)\s+path\s+(.+)$/);
    if (def) {
      matchers.set(def[1], def[2].trim().split(/\s+/));
      continue;
    }

    const use = line.match(/^\s*header\s+@(\w+)\s+([A-Za-z-]+)\s+"(.*)"$/);
    if (use) {
      for (const path of matchers.get(use[1]) || []) {
        fromCaddy.set(path + "\u0000" + use[2], squash(use[3]));
      }
    }
  }
}

for (const [key, value] of fromHeaders) {
  const [path, name] = key.split("\u0000");
  if (!fromCaddy.has(key)) fail("Caddyfile", `does not set ${name} for ${path}, and _headers does`);
  else if (fromCaddy.get(key) !== value) fail("Caddyfile", `sets a different ${name} for ${path} than _headers does`);
}

for (const key of fromCaddy.keys()) {
  const [path, name] = key.split("\u0000");
  if (!fromHeaders.has(key)) fail("site/_headers", `does not set ${name} for ${path}, and the Caddyfile does`);
}

// If either side comes back nearly empty the parser broke, and silence
// would read as agreement.
if (fromHeaders.size < 8) fail("site/_headers", "was read but almost nothing came out of it");
if (fromCaddy.size < 8) fail("Caddyfile", "was read but almost nothing came out of it");

/* ---------------------------------------------------------------------
   8. The sitemap lists every page, by the address each page claims.

      A page that calls itself one thing and is listed as another tells a
      search engine two stories. This reads the canonical out of each page
      and requires the sitemap to say exactly the same set, so neither can
      be edited alone.
   --------------------------------------------------------------------- */

{
  const sitemap = readFileSync(join(SITE, "sitemap.xml"), "utf8");
  const listed = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));

  const claimed = new Map(); // canonical -> page
  for (const [name, page] of pages) {
    if (name === "404.html") continue; // a 404 is not indexed and not listed
    const m = page.html.match(/<link rel="canonical" href="([^"]+)"/);
    if (!m) {
      fail(name, "has no canonical link, so there is nothing to compare the sitemap against");
      continue;
    }
    claimed.set(m[1], name);

    // og:url is the same address written a second time, so it drifts too.
    const og = page.html.match(/property="og:url" content="([^"]+)"/);
    if (og && og[1] !== m[1]) fail(name, `says og:url is ${og[1]} and canonical is ${m[1]}`);
  }

  for (const [url, name] of claimed) {
    if (!listed.has(url)) fail("site/sitemap.xml", `does not list ${url}, which ${name} calls itself`);
  }
  for (const url of listed) {
    if (!claimed.has(url)) fail("site/sitemap.xml", `lists ${url}, which no page calls itself`);
  }
}

/* ------------------------------------------------------------------- */

if (problems.length) {
  for (const p of problems) console.error(`${p.file}: ${p.message}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log(
  `${FILES.size} files, ${PAGES.length} pages, ${served.size} of them served, nothing broken.`,
);
