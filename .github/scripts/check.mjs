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
const PAGES = ["index.html", "faq.html", "404.html"];

const problems = [];
function fail(file, message) {
  problems.push({ file, message });
}

/* ---------------------------------------------------------------------
   Every file in the repository, spelled exactly as it is on disk.

   Membership is tested against this list rather than asking the file
   system, because Windows would answer yes to `Team/Thiago.webp` and the
   Linux container it is deployed on would answer no.
   --------------------------------------------------------------------- */

const SKIP = new Set([".git", ".github", "node_modules"]);

function walk(dir, out = new Set()) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.add(relative(ROOT, full).split("\\").join("/"));
  }
  return out;
}

const FILES = walk(ROOT);

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
  const html = readFileSync(join(ROOT, name), "utf8");
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
  }
}

const HTML_ATTRS = /\b(href|src|poster|content)="([^"]*)"/g;
const CSS_URLS = /\b()url\(["']?([^"')]+)["']?\)/g;

for (const [name, page] of pages) checkRefs(name, page.html, HTML_ATTRS);

for (const css of [...FILES].filter((f) => f.endsWith(".css"))) {
  const text = readFileSync(join(ROOT, css), "utf8");
  for (const m of text.matchAll(CSS_URLS)) {
    const value = m[2].trim();
    if (!isLocalPath(value)) continue;
    const path = posix.normalize(posix.join(posix.dirname(css), value.split("#")[0]));
    if (!FILES.has(path)) fail(css, `points at a file that is not there: ${value}`);
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

/* ------------------------------------------------------------------- */

if (problems.length) {
  for (const p of problems) console.error(`${p.file}: ${p.message}`);
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}

console.log(`${FILES.size} files, ${PAGES.length} pages, nothing broken.`);
