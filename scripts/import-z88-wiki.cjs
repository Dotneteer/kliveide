/**
 * Imports a Confluence space of the Cambridge Z88 wiki (cambridgez88.jira.com) into the
 * documentation site as MDX, one space per area (`SPACES` below):
 * - "UG", the Cambridge Z88 User Guide -> `docs/content/en/library/cambridge-z88/user-guide/`
 * - "DN", the Z88 Developers' Notes     -> `docs/content/en/library/cambridge-z88/developers-notes/`
 * - "BBCREF", the BBC BASIC (Z80) Reference Guide -> `docs/content/en/library/cambridge-z88/bbc-basic/`
 *
 * The BBCREF space is a single wiki page that embeds a Google Doc; the manual is that document.
 * Its import fetches the document's HTML export and turns it into the same markup the Confluence
 * pages use (`loadGdoc` below), so one converter serves every space. The document's chapters
 * (Heading 1) become folders and their sections (Heading 2) pages; its own table of contents,
 * which lists printed page numbers, is dropped.
 *
 * The Library is the navbar area of the machines' own manuals, one folder per machine
 * (`content/en/library/<machine>/_meta.ts` lists its manuals). Each manual is in the site search;
 * its sidebar follows the space's page tree. Its pictures go to `docs/public/images/en/<images>/`. A link to a page of another space listed in `SPACES`
 * goes to that page's area on the site, not to the wiki.
 *
 * What the conversion does with the manual's Confluence markup:
 * - key legend pictures (enter-key.png, symb_diamond.png, ...) -> <Key k="..." /> keycaps
 * - <span class="type"> (what the reader types)                 -> <Typed>...</Typed>
 * - <span class="screen"> (what the Z88 shows)                  -> inline code
 * - info / note / warning / tip macros                          -> <Callout>
 * - every other picture (and Gliffy diagram)                    -> a .webp beside a <Shot>
 * - simple tables -> GFM tables; tables with spans or block content -> Nextra's <Table>
 * - side-by-side layout rows whose first cell is a short label (a key, a command) -> a two-column
 *   table; any other layout row is flattened in reading order
 *
 * Usage:
 *   node scripts/import-z88-wiki.cjs --space DN            # fetch (cached), convert, write
 *   node scripts/import-z88-wiki.cjs --space DN --refresh  # fetch again, ignoring the cache
 *   node scripts/import-z88-wiki.cjs --space DN --out <dir>  # write into <dir> instead of docs/
 *
 * The cache (raw page JSON and downloaded pictures) lives in the OS temp folder. Re-running the
 * import overwrites the generated area: edits made after the review belong in the MDX files, and
 * then the import should not be re-run over them.
 */
const { createRequire } = require("node:module");
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { execFileSync } = require("node:child_process");
const { fileURLToPath, pathToFileURL } = require("node:url");
const os = require("node:os");

const repoRoot = join(__dirname, "..");
const docsRequire = createRequire(join(repoRoot, "docs", "package.json"));
const parse5 = docsRequire("parse5");
const sharp = docsRequire("sharp");

const HOST = "https://cambridgez88.jira.com";
const SITE = `${HOST}/wiki`;
const GENERATOR = "scripts/import-z88-wiki.cjs";

/** The spaces this script imports, by Confluence space key */
const SPACES = {
  UG: {
    path: "cambridge-z88/user-guide",
    images: "z88-user-guide",
    title: "Cambridge Z88 User Guide",
    /** "Section One - Getting started" -> "getting-started" */
    slug: (title) => title.replace(/^Section [A-Za-z]+ - /, ""),
    intro: (root) =>
      `This is the **Cambridge Z88 User Guide**, imported with its author's agreement from the [Cambridge Z88 wiki](${SITE}/spaces/UG/overview). The pages follow the original manual's structure; the conventions it uses for keys, typed text and screen text are explained in [Conventions in this manual](${root}/getting-started/conventions-in-this-manual).`
  },
  DN: {
    path: "cambridge-z88/developers-notes",
    images: "z88-developers-notes",
    title: "Z88 Developers' Notes",
    /** "OS_Bye, Exit application" -> "os-bye": a system call's page is named by the call */
    slug: (title) => title.match(/^([A-Z]{2}_[A-Za-z0-9]+),/)?.[1] ?? title,
    intro: () =>
      `These are the **Z88 Developers' Notes**, imported from the [Cambridge Z88 wiki](${SITE}/spaces/DN/overview): how to write applications for the Z88 and its OZ operating system, its system calls, and its hardware. The pages follow the original notes' structure.`
  },
  BBCREF: {
    /** The space's home page embeds the manual as a Google Doc */
    gdoc: true,
    path: "cambridge-z88/bbc-basic",
    images: "z88-bbc-basic",
    title: "BBC BASIC (Z80) Reference Guide",
    /**
     * "AND (A.)" -> "and", "GET/GET$" -> "get", "CHR$" -> "chr-str", "PRINT# (P.#)" -> "print-hash",
     * "*EDIT (*E.)" -> "star-edit": a keyword's page is named by the keyword
     */
    slug: (title) =>
      title
        .replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/\/.*$/, "")
        .replace(/^\*/, "star ")
        .replace(/\$/g, " str")
        .replace(/#/g, " hash"),
    /** The document's pictures have no names or alt texts of their own */
    alt: {
      "image1.png": "The Z88's Index, with BBC BASIC selected in the Applications list",
      "image2.png": "The key combinations that switch the printer on and off",
      "image3.png": "A suspended BBC BASIC activity in the Index",
      "image4.png": "The Index with no suspended activities",
      "image5.png": "Two BBC BASIC activities suspended in the Index",
      "image6.png": "BBC BASIC printing the result of VDU 1,ASC\"2\",ASC\"F\"",
      "image7.gif": "Flowchart of the binary chop search",
      "image8.png": "BBC BASIC's start-up screen",
      "image9.png": "The signs of the trigonometric functions in the four quadrants",
      "image10.png": "How printer output flows from an application through the Printer Filter to the serial port",
      "image11.png": "BBC BASIC after VDU 1,50,42,79",
      "image12.png": "The letters that name the box character pieces",
      "image13.png": "BBC BASIC's start-up screen after loading the Z88 Patch",
      "image14.gif": "R. T. Russell's logo"
    },
    intro: (root) =>
      `This is the **BBC BASIC (Z80) Reference Guide** for the Cambridge Z88, second edition, imported from the [Cambridge Z88 wiki](${SITE}/spaces/BBCREF/overview), where it is published as a Google Document. It describes BBC BASIC as the Z88 runs it, including the commands the Z88 Patch adds. The pages follow the manual's chapters; every keyword has a page of its own under [Statements and functions](${root}/statements-and-functions).`
  }
};

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const SPACE_KEY = argValue("--space");
if (!SPACES[SPACE_KEY]) {
  console.error(`Usage: node ${GENERATOR} --space <${Object.keys(SPACES).join("|")}> [--refresh] [--out <dir>]`);
  process.exit(2);
}
/** Where every imported space lives on the site, under `content/en/` */
const PARENT = "library";
const pathOf = (spaceKey) => `${PARENT}/${SPACES[spaceKey].path}`;
/** The pictures' folder under public/images/en/, and the prefix of every <Shot> */
const AREA = SPACES[SPACE_KEY].images;
const AREA_PATH = pathOf(SPACE_KEY);
const OUT = argValue("--out") ?? join(repoRoot, "docs");
const CONTENT_DIR = join(OUT, "content", "en");
const IMAGE_DIR = join(OUT, "public", "images", "en", AREA);
const CACHE_ROOT = join(os.tmpdir(), "kliveide-z88-import");
const REFRESH = process.argv.includes("--refresh");
/** The widest a picture is stored and shown */
const MAX_WIDTH = 900;

// ------------------------------------------------------------------------------------------------
// Fetching (cached)

async function fetchCached(url, file, { binary = false, space = SPACE_KEY } = {}) {
  const path = join(CACHE_ROOT, space, file);
  if (!REFRESH && existsSync(path)) return binary ? readFileSync(path) : readFileSync(path, "utf8");
  if (url.startsWith("file:")) return readFileSync(fileURLToPath(url));
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) return undefined;
  const data = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return data;
}

async function fetchJson(url, file, space = SPACE_KEY) {
  const text = await fetchCached(url, file, { space });
  return text === undefined ? undefined : JSON.parse(text);
}

async function listPages(spaceKey = SPACE_KEY) {
  if (SPACES[spaceKey].gdoc) return (await loadGdoc(spaceKey)).pages;
  const space = await fetchJson(`${SITE}/rest/api/space/${spaceKey}`, "space.json", spaceKey);
  const pages = [];
  // --- The "next" links of the v2 API start at the host ("/wiki/api/v2/...")
  let next = `/wiki/api/v2/spaces/${space.id}/pages?limit=250&status=current`;
  for (let i = 0; next; i++) {
    const page = await fetchJson(`${HOST}${next}`, `pages-${i}.json`, spaceKey);
    pages.push(...page.results.map(({ id, title, parentId, position }) => ({ id, title, parentId, position })));
    next = page._links?.next;
  }
  return pages;
}

async function loadBody(id) {
  const json = await fetchJson(`${SITE}/rest/api/content/${id}?expand=body.storage,version`, `raw/${id}.json`);
  return { storage: json.body.storage.value, version: json.version.number };
}

/** The id of a page in another space (or this one) by title, for its attachments */
const foreignIds = new Map();
async function pageIdByTitle(spaceKey, title) {
  const key = `${spaceKey}/${title}`;
  if (!foreignIds.has(key)) {
    const json = await fetchJson(
      `${SITE}/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&title=${encodeURIComponent(title)}`,
      `lookup/${encodeURIComponent(key)}.json`
    );
    foreignIds.set(key, json?.results?.[0]?.id);
  }
  return foreignIds.get(key);
}

// ------------------------------------------------------------------------------------------------
// The page tree and its routes

function slugify(title, spaceKey = SPACE_KEY) {
  return SPACES[spaceKey]
    .slug(title)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTree(pages, spaceKey = SPACE_KEY) {
  const path = pathOf(spaceKey);
  const byId = new Map(pages.map((p) => [p.id, { ...p, children: [] }]));
  let root;
  for (const page of byId.values()) {
    const parent = byId.get(page.parentId);
    if (parent) parent.children.push(page);
    else root = page;
  }
  const order = (a, b) => (a.position ?? 0) - (b.position ?? 0);
  const assign = (node, path) => {
    node.route = path;
    node.children.sort(order);
    const used = new Set();
    for (const child of node.children) {
      let slug = slugify(child.title, spaceKey);
      while (used.has(slug)) slug += "-2";
      used.add(slug);
      child.slug = slug;
      assign(child, `${path}/${slug}`);
    }
  };
  root.slug = path.split("/").pop();
  assign(root, `/en/${path}`);
  return { root, byId };
}

// ------------------------------------------------------------------------------------------------
// MDX text helpers

const KEY_FILES = {
  "enter-key": "enter", "esc-key": "esc", "tab-key": "tab", "del-key": "del", "menu-key": "menu",
  "index-key": "index", "help-key": "help", "space-key": "space", "capslock-key": "capslock",
  "shift-key": "shift", "alt-key": "alt", "ctrl-key": "ctrl", symb_diamond: "diamond",
  symb_square: "square", symb_left: "left", symb_right: "right", symb_up: "up", symb_down: "down"
};

function keyOf(filename) {
  const base = filename.replace(/\.[a-z]+$/i, "");
  return KEY_FILES[base];
}

function escapeText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/[`*_{}[\]<>|~#]/g, (c) => `\\${c}`)
    .replace(/&(?=[a-zA-Z#][a-zA-Z0-9]*;)/g, "&amp;");
}

/** Escapes what would start a block construct at the start of a paragraph */
function guardLineStart(line) {
  return line
    .replace(/^(\s*)([-+=])(\s|$)/, "$1\\$2$3")
    .replace(/^(\s*\d+)([.)])(\s|$)/, "$1\\$2$3");
}

function codeSpan(text) {
  const t = text.replace(/\s+/g, " ");
  if (!t.trim()) return t;
  const ticks = (t.match(/`+/g) || []).reduce((m, s) => Math.max(m, s.length), 0);
  const fence = "`".repeat(ticks + 1);
  const pad = t.startsWith("`") || t.endsWith("`") ? " " : "";
  return `${fence}${pad}${t}${pad}${fence}`;
}

/** A JSX attribute value: a plain string, or an expression when JSX strings cannot hold it */
function attrString(value) {
  return /["\\{}]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;
}

function humanize(filename) {
  return filename
    .replace(/\.[a-z]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fileSlug(filename) {
  return (
    filename
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "image"
  );
}

// ------------------------------------------------------------------------------------------------
// DOM helpers (parse5 tree)

const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const kids = (node) => node.childNodes ?? [];
const tag = (node) => node.tagName ?? node.nodeName;
const findChild = (node, name) => kids(node).find((c) => tag(c) === name);
const findAll = (node, name, out = []) => {
  for (const c of kids(node)) {
    if (tag(c) === name) out.push(c);
    findAll(c, name, out);
  }
  return out;
};
function textOf(node) {
  if (node.nodeName === "#text") return node.value;
  if (tag(node) === "br") return "\n";
  return kids(node).map(textOf).join("");
}
function macroParam(node, name) {
  const p = kids(node).find((c) => tag(c) === "ac:parameter" && attr(c, "ac:name") === name);
  return p ? textOf(p).trim() : undefined;
}

/** Confluence storage XML -> a parse5 fragment (self-closing namespaced tags, CDATA fixed up) */
function parseStorage(xml) {
  const fixed = xml
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, body) =>
      body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    )
    .replace(/<([a-z]+:[a-z-]+)((?:\s+[^>]*?)?)\s*\/>/g, "<$1$2></$1>");
  return parse5.parseFragment(fixed);
}

// ------------------------------------------------------------------------------------------------
// Conversion

const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "pre", "div", "blockquote", "hr",
  "ac:layout", "ac:layout-section", "ac:layout-cell", "ac:rich-text-body", "colgroup", "tbody"
]);
const BLOCK_MACROS = new Set([
  "info", "note", "warning", "tip", "code", "gliffy", "toc", "pagetree", "recently-updated",
  "searchbox", "style", "column", "section", "panel", "expand", "noformat", "children",
  // --- The Developers' Notes build some tables from macros, and wrap preformatted tables in a span
  "table", "span"
]);
const DROPPED_MACROS = new Set(["toc", "style", "pagetree", "recently-updated", "searchbox", "children"]);

class PageConverter {
  constructor(page, tree, report) {
    this.page = page;
    this.tree = tree;
    this.report = report;
    this.images = []; // { owner, filename, url, target }
    this.headingOffset = 1;
    this.usesTable = false;
    this.usesCallout = false;
  }

  // --- Images ----------------------------------------------------------------------------------

  /** Resolves an <ac:image> to a key legend, a dropped decoration, or a picture to download */
  imageInfo(node) {
    const att = findChild(node, "ri:attachment");
    const url = findChild(node, "ri:url");
    let filename, owner;
    if (att) {
      filename = attr(att, "ri:filename");
      const ref = findChild(att, "ri:page");
      owner = ref
        ? { space: attr(ref, "ri:space-key") ?? SPACE_KEY, title: attr(ref, "ri:content-title") }
        : { id: this.page.id };
    } else if (url) {
      const href = attr(url, "ri:value");
      filename = decodeURIComponent(href.split("?")[0].split("/").pop());
      owner = { url: href.replace(/&amp;/g, "&") };
    } else {
      return { kind: "none" };
    }
    const key = keyOf(filename);
    if (key) return { kind: "key", key };
    if (/^tick\.gif$/i.test(filename)) return { kind: "text", text: "✓" };
    if (/^top\.gif$/i.test(filename)) return { kind: "none" };
    return {
      kind: "picture",
      filename,
      owner,
      alt: attr(node, "ac:alt") || attr(node, "ac:title") || this.altFromFile(filename),
      width: Number(attr(node, "ac:width")) || undefined
    };
  }

  /** A file name as alt text, or the page's name when the file name says nothing ("103.png") */
  altFromFile(filename) {
    const text = humanize(filename);
    return /[a-z]{3,}/i.test(text) ? text : `Illustration for \u201C${this.page.title}\u201D`;
  }

  /** Registers a picture for download and returns its <Shot> */
  shot(info) {
    const ownerKey = info.owner.id ?? info.owner.title ?? "external";
    // --- A picture by URL is stored with the page that shows it
    const ownerNode = info.owner.id || info.owner.url
      ? this.tree.byId.get(info.owner.id ?? this.page.id)
      : info.owner.space === SPACE_KEY
        ? [...this.tree.byId.values()].find((p) => p.title === info.owner.title)
        : undefined;
    const folder = ownerNode
      ? ownerNode.route.replace(`/en/${AREA_PATH}`, "").replace(/^\//, "") || "welcome"
      : `external/${fileSlug(info.owner.space ?? "web")}-${fileSlug(String(ownerKey))}`;
    const target = `${folder}/${fileSlug(info.filename)}.webp`;
    this.images.push({ ...info, target });
    const width = info.width ? Math.min(info.width, MAX_WIDTH) : `__WIDTH__${target}__`;
    return `<Shot src=${attrString(`${AREA}/${target}`)} alt=${attrString(info.alt)} width={${width}} />`;
  }

  // --- Links -----------------------------------------------------------------------------------

  /** The site route of a page of this space or of another imported one, by title */
  routeOfTitle(title, space = SPACE_KEY) {
    const tree = space === SPACE_KEY ? this.tree : this.tree.others[space];
    if (!tree) return undefined;
    return [...tree.byId.values()].find((p) => p.title === title)?.route;
  }

  /** The site route of a page of this space or of another imported one, by id */
  routeOfId(id) {
    for (const tree of [this.tree, ...Object.values(this.tree.others)]) {
      if (tree.byId.has(id)) return tree.byId.get(id).route;
    }
    return undefined;
  }

  linkTarget(node) {
    const pageRef = findChild(node, "ri:page");
    const anchor = attr(node, "ac:anchor");
    const hash = anchor ? `#${anchorId(anchor)}` : "";
    if (pageRef) {
      const space = attr(pageRef, "ri:space-key") ?? SPACE_KEY;
      const title = attr(pageRef, "ri:content-title");
      const route = this.routeOfTitle(title, space);
      if (route) return { href: route + hash, fallback: title };
      this.report.external.add(`${space}: ${title}`);
      return {
        href: `${SITE}/display/${encodeURIComponent(space)}/${encodeURIComponent(title).replace(/%20/g, "+")}`,
        fallback: title
      };
    }
    const entity = findChild(node, "ri:content-entity");
    if (entity) {
      const id = attr(entity, "ri:content-id");
      const target = this.tree.byId.get(id);
      const route = this.routeOfId(id);
      return route
        ? { href: route + hash, fallback: target?.title ?? "this page" }
        : { href: `${SITE}/pages/viewpage.action?pageId=${id}`, fallback: "this page" };
    }
    const att = findChild(node, "ri:attachment");
    if (att) {
      const filename = attr(att, "ri:filename");
      return { href: `${SITE}/download/attachments/${this.page.id}/${encodeURIComponent(filename)}`, fallback: filename };
    }
    const user = findChild(node, "ri:user");
    if (user) return { href: undefined, fallback: "" };
    if (anchor) return { href: hash, fallback: anchor };
    return { href: undefined, fallback: "" };
  }

  mapHref(href) {
    // --- The Google Doc wraps every outside link in a redirect
    const redirect = href.match(/^https?:\/\/www\.google\.com\/url\?q=([^&]*)/);
    if (redirect) href = decodeURIComponent(redirect[1]);
    if (href.startsWith("#")) {
      // --- A link to a heading or bookmark of the Google Doc
      const target = GDOC_ANCHORS.get(href.slice(1));
      const route = target && this.routeOfId(target.pageId);
      if (route) return route + (target.hash ? `#${target.hash}` : "");
      this.report.external.add(`unresolved anchor: ${href}`);
      return undefined;
    }
    const space = href.match(/cambridgez88\.jira\.com\/wiki\/spaces\/([A-Z]+)\/?(?:overview)?$/);
    const spaceTree = space && (space[1] === SPACE_KEY ? this.tree : this.tree.others[space[1]]);
    if (spaceTree) return spaceTree.root.route;
    const m =
      href.match(/cambridgez88\.jira\.com\/wiki\/spaces\/[A-Z]+\/pages\/(\d+)/) ||
      href.match(/pageId=(\d+)/);
    const byId = m && this.routeOfId(m[1]);
    if (byId) return byId;
    const d = href.match(/cambridgez88\.jira\.com\/wiki\/display\/([A-Z]+)\/([^#?]+)(#.*)?/);
    if (d) {
      const route = this.routeOfTitle(decodeURIComponent(d[2].replace(/\+/g, " ")), d[1]);
      if (route) return route + (d[3] ? `#${anchorId(d[3].slice(1))}` : "");
    }
    return href;
  }

  // --- Inline content --------------------------------------------------------------------------

  /** Converts inline nodes; content pictures are returned through `ctx.pending` as blocks */
  inline(nodes, ctx) {
    let out = "";
    for (const node of nodes) out += this.inlineNode(node, ctx);
    return out;
  }

  inlineNode(node, ctx) {
    if (node.nodeName === "#text") {
      const t = node.value.replace(/ /g, " ").replace(/\s+/g, " ");
      return ctx.code ? t : escapeText(t);
    }
    if (node.nodeName === "#comment") return "";
    const name = tag(node);
    switch (name) {
      case "br":
        return ctx.code ? " " : "<br />";
      case "strong":
      case "b":
        return this.wrap(node, ctx, "**", "strong");
      case "em":
      case "i":
        return this.wrap(node, ctx, "*", "em");
      case "u":
      case "s":
      case "del":
      case "sup":
      case "sub": {
        const inner = this.inline(kids(node), ctx).trim();
        const t = name === "s" ? "del" : name;
        return inner ? `<${t}>${inner}</${t}>` : "";
      }
      case "code":
        return this.codeLike(node, ctx);
      case "span": {
        const cls = attr(node, "class") ?? "";
        if (/\bscreen\b/.test(cls)) return this.screen(node, ctx);
        if (/\btypee?\b/.test(cls)) return this.typed(node, ctx);
        return this.inline(kids(node), ctx);
      }
      case "a": {
        const href = attr(node, "href");
        const text = this.inline(kids(node), ctx).trim();
        const to = href && this.mapHref(href);
        if (!to) return text;
        return text ? `[${text}](${to})` : "";
      }
      case "ac:link": {
        const { href, fallback } = this.linkTarget(node);
        const body = findChild(node, "ac:plain-text-link-body") ?? findChild(node, "ac:link-body");
        let text = body
          ? findChild(node, "ac:link-body")
            ? this.inline(kids(body), ctx).trim()
            : escapeText(textOf(body).trim())
          : escapeText(fallback);
        if (!text) text = escapeText(fallback);
        if (!href) return text;
        return `[${text}](${href})`;
      }
      case "ac:image": {
        const info = this.imageInfo(node);
        if (info.kind === "key") return `<Key k="${info.key}" />`;
        if (info.kind === "text") return info.text;
        if (info.kind === "none") return "";
        ctx.pending.push(this.shot(info));
        return "";
      }
      case "ac:structured-macro": {
        const macro = (attr(node, "ac:name") ?? "").toLowerCase();
        if (macro === "anchor") {
          const id = macroParam(node, "") ?? macroParam(node, "anchor");
          if (id) ctx.anchors.push(anchorId(id));
          return "";
        }
        if (macro === "status") return `**${escapeText(macroParam(node, "title") ?? "")}**`;
        if (BLOCK_MACROS.has(macro)) {
          ctx.pending.push(...this.blockMacro(node));
          return "";
        }
        this.report.unknown.add(`macro:${macro}`);
        return this.inline(kids(node), ctx);
      }
      case "ac:inline-comment-marker":
      case "ac:emoticon":
      case "time":
        return name === "ac:emoticon" ? "" : this.inline(kids(node), ctx);
      case "ac:parameter":
        return "";
      default:
        if (BLOCK_TAGS.has(name) || /^h[1-6]$/.test(name)) {
          // --- A block inside inline content (a list in a span, ...): hand it to the block level
          ctx.pending.push(...this.blocks([node]));
          return "";
        }
        this.report.unknown.add(`inline:${name}`);
        return this.inline(kids(node), ctx);
    }
  }

  wrap(node, ctx, mark, jsx) {
    const raw = this.inline(kids(node), ctx);
    const inner = raw.trim();
    if (!inner || inner === "<br />") return raw.includes(" ") ? " " : "";
    if (ctx.code) return raw;
    const lead = raw.match(/^\s*/)[0] ? " " : "";
    const trail = raw.match(/\s*$/)[0] ? " " : "";
    // --- Delimiter runs need "flanking" text; JSX keeps emphasis safe next to punctuation
    return !/^[\\<*`]|[\\>*`]$/.test(inner)
      ? `${lead}${mark}${inner}${mark}${trail}`
      : `${lead}<${jsx}>${inner}</${jsx}>${trail}`;
  }

  /** <code>: screen text as inline code; with keys or typed spans inside, its parts */
  codeLike(node, ctx) {
    const cls = attr(node, "class") ?? "";
    const spans = findAll(node, "span");
    if (spans.some((s) => /\btypee?\b/.test(attr(s, "class") ?? "")) && !/\bscreen\b/.test(cls)) {
      return this.inline(kids(node), ctx);
    }
    return this.screen(node, ctx);
  }

  /** Screen text: inline code, split around key legends */
  screen(node, ctx) {
    const parts = [];
    let text = "";
    const visit = (n) => {
      if (n.nodeName === "#text") text += n.value.replace(/ /g, " ");
      else if (tag(n) === "br") {
        flush();
        parts.push("<br />");
      } else if (tag(n) === "ac:image") {
        const info = this.imageInfo(n);
        if (info.kind === "key") {
          flush();
          parts.push(`<Key k="${info.key}" />`);
        } else if (info.kind === "text") text += info.text;
        else if (info.kind === "picture") {
          flush();
          ctx.pending.push(this.shot(info));
        }
      } else if (tag(n) === "span" && /\btypee?\b/.test(attr(n, "class") ?? "")) {
        flush();
        parts.push(this.typed(n, ctx));
      } else kids(n).forEach(visit);
    };
    const flush = () => {
      if (text.trim()) {
        const lead = /^\s/.test(text) ? " " : "";
        const trail = /\s$/.test(text) ? " " : "";
        parts.push(`${lead}${codeSpan(text.trim())}${trail}`);
      } else if (text) parts.push(" ");
      text = "";
    };
    kids(node).forEach(visit);
    flush();
    return parts.join("");
  }

  typed(node, ctx) {
    const inner = this.inline(kids(node), { ...ctx, code: false })
      .replace(/^(\s*<br \/>)+|(<br \/>\s*)+$/g, "");
    if (!inner.trim()) return inner ? " " : "";
    const lead = /^\s/.test(inner) ? " " : "";
    const trail = /\s$/.test(inner) ? " " : "";
    return `${lead}<Typed>${inner.trim()}</Typed>${trail}`;
  }

  // --- Block content ---------------------------------------------------------------------------

  /** Converts a node list to an array of MDX blocks */
  blocks(nodes) {
    const out = [];
    let run = [];
    const flushRun = () => {
      if (run.length) out.push(...this.paragraph(run));
      run = [];
    };
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const name = tag(node);
      if (name === "pre") {
        // --- Consecutive <pre> lines are one preformatted block (the instruction set tables)
        const trimEnd = (t) => t.replace(/[\s\u00a0]+$/, "");
        const lines = [trimEnd(textOf(node))];
        while (tag(nodes[i + 1] ?? {}) === "pre") lines.push(trimEnd(textOf(nodes[++i])));
        flushRun();
        out.push(fence(lines.join("\n")));
        continue;
      }
      const isBlockMacro =
        name === "ac:structured-macro" && BLOCK_MACROS.has((attr(node, "ac:name") ?? "").toLowerCase());
      if (BLOCK_TAGS.has(name) || isBlockMacro || /^h[1-6]$/.test(name) || name === "ac:layout-section") {
        flushRun();
        out.push(...this.block(node));
      } else run.push(node);
    }
    flushRun();
    return out.filter((b) => b && b.trim());
  }

  /** An inline run -> a paragraph, with any pictures found in it after it */
  paragraph(nodes) {
    const ctx = { pending: [], anchors: [] };
    let text = this.inline(floatOrder(nodes), ctx)
      .replace(/(\s*<br \/>\s*)+$/g, "")
      .replace(/^(\s*<br \/>\s*)+/g, "")
      .replace(/ {2,}/g, " ")
      .trim();
    const out = [];
    const anchors = ctx.anchors.map((id) => `<a id="${id}" />`).join("");
    if (anchors) out.push(anchors);
    if (text) out.push(guardLineStart(text));
    out.push(...ctx.pending);
    return out;
  }

  block(node) {
    const name = tag(node);
    if (name === "p" || name === "blockquote") {
      const blocks = this.paragraph(kids(node));
      return name === "blockquote" ? blocks.map((b) => b.replace(/^/gm, "> ")) : blocks;
    }
    if (/^h[1-6]$/.test(name)) return this.heading(node);
    if (name === "ul" || name === "ol") return [this.list(node)];
    if (name === "table") return [this.table(node)];
    if (name === "pre") return [fence(textOf(node))];
    if (name === "hr") return ["---"];
    if (name === "ac:layout") return this.layout(node);
    if (name === "ac:structured-macro") return this.blockMacro(node);
    if (name === "colgroup") return [];
    return this.blocks(kids(node));
  }

  heading(node) {
    const ctx = { pending: [], anchors: [] };
    const text = this.inline(kids(node), ctx)
      .replace(/<br \/>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\*\*(.*)\*\*$/, "$1")
      .trim();
    if (!text) return [...ctx.anchors.map((id) => `<a id="${id}" />`), ...ctx.pending];
    const level = Math.min(6, Math.max(2, Number(tag(node)[1]) + this.headingOffset));
    const id = ctx.anchors.length ? ` [#${ctx.anchors[0]}]` : "";
    const extra = ctx.anchors.slice(1).map((a) => `<a id="${a}" />`);
    return [...extra, `${"#".repeat(level)} ${text}${id}`, ...ctx.pending];
  }

  list(node, depth = 0) {
    const ordered = tag(node) === "ol";
    const items = kids(node).filter((c) => tag(c) === "li");
    return items
      .map((li, i) => {
        const marker = ordered ? `${i + 1}. ` : "- ";
        const pad = " ".repeat(marker.length);
        const parts = this.blocks(kids(li));
        if (!parts.length) return marker.trim();
        const [first, ...rest] = parts;
        const body = [first.replace(/\n/g, `\n${pad}`), ...rest.map((b) => pad + b.replace(/\n/g, `\n${pad}`))];
        return marker + body.join(`\n\n`);
      })
      .join(ordered || items.some((li) => this.blocks(kids(li)).length > 1) ? "\n\n" : "\n");
  }

  blockMacro(node) {
    const macro = (attr(node, "ac:name") ?? "").toLowerCase();
    if (DROPPED_MACROS.has(macro)) return [];
    if (["info", "note", "warning", "tip", "panel"].includes(macro)) {
      this.usesCallout = true;
      const type = { info: "info", note: "warning", warning: "error", tip: "default", panel: "default" }[macro];
      const title = macroParam(node, "title");
      const body = this.blocks(kids(findChild(node, "ac:rich-text-body") ?? node));
      const head = title ? [`**${escapeText(title)}**`] : [];
      return [`<Callout type="${type}">\n\n${[...head, ...body].join("\n\n")}\n\n</Callout>`];
    }
    if (macro === "code" || macro === "noformat") {
      const body = findChild(node, "ac:plain-text-body");
      return [fence(body ? textOf(body) : "")];
    }
    if (macro === "gliffy") {
      const diagram = macroParam(node, "name");
      if (!diagram) return [];
      return [this.shot({ filename: `${diagram}.png`, owner: { id: this.page.id }, alt: diagram, gliffy: true })];
    }
    if (macro === "table") return [this.macroTable(node)];
    if (macro === "expand") {
      const title = macroParam(node, "title") ?? "Details";
      const body = this.blocks(kids(findChild(node, "ac:rich-text-body") ?? node));
      return [`<details>\n<summary>${escapeText(title)}</summary>\n\n${body.join("\n\n")}\n\n</details>`];
    }
    // --- column / section: layout containers
    const rich = findChild(node, "ac:rich-text-body");
    return this.blocks(kids(rich ?? node).filter((c) => tag(c) !== "ac:parameter"));
  }

  // --- Layouts ---------------------------------------------------------------------------------

  layout(node) {
    const out = [];
    let rows = [];
    const flushRows = () => {
      if (rows.length) out.push(this.labelTable(rows));
      rows = [];
    };
    for (const section of kids(node).filter((c) => tag(c) === "ac:layout-section")) {
      const cells = kids(section)
        .filter((c) => tag(c) === "ac:layout-cell")
        .map((c) => kids(c))
        .filter((c) => !isEmpty(c));
      if (cells.length >= 2 && isLabel(cells[0])) {
        rows.push(cells);
        continue;
      }
      flushRows();
      for (const cell of cells) out.push(...this.blocks(cell));
    }
    flushRows();
    return out;
  }

  /** Layout rows of "short label | description" as a two-column table */
  labelTable(rows) {
    const cells = rows.map((cells) => [
      { blocks: this.blocks(cells[0]), nowrap: true },
      { blocks: cells.slice(1).flatMap((c) => this.blocks(c)) }
    ]);
    return this.renderTable(cells, { header: false });
  }

  // --- Tables ----------------------------------------------------------------------------------

  /** A table built from the table / tr / td macros (the Developers' Notes' glossary) */
  macroTable(node) {
    const body = (n) => kids(findChild(n, "ac:rich-text-body") ?? n);
    const named = (n, name) =>
      tag(n) === "ac:structured-macro" && (attr(n, "ac:name") ?? "").toLowerCase() === name;
    const rows = body(node)
      .filter((tr) => named(tr, "tr"))
      .map((tr) =>
        body(tr)
          .filter((td) => named(td, "td"))
          .map((td, i) => ({
            colSpan: 1,
            rowSpan: 1,
            nowrap: i === 0 && macroParam(td, "nowrap") === "true",
            blocks: this.blocks(body(td))
          }))
      )
      // --- Rows with nothing in them are spacers
      .filter((r) => r.some((c) => c.blocks.length));
    return this.renderTable(rows, { header: false });
  }

  table(node) {
    const rows = findAll(node, "tr").map((tr) =>
      kids(tr)
        .filter((c) => tag(c) === "td" || tag(c) === "th")
        .map((cell) => ({
          th: tag(cell) === "th",
          colSpan: Number(attr(cell, "colspan")) || 1,
          rowSpan: Number(attr(cell, "rowspan")) || 1,
          blocks: this.blocks(kids(cell))
        }))
    );
    // --- A table with headings in its cells is a layout (the BBC BASIC keywords: a keyword and
    // --- its title in one row, its description in the next): its rows become sections
    if (rows.some((r) => r.some((c) => c.blocks.some(isHeading)))) return this.flattenTable(rows);
    const header = rows.length > 1 && rows[0].every((c) => c.th);
    return this.renderTable(rows, { header });
  }

  flattenTable(rows) {
    const out = [];
    for (const row of rows) {
      const headings = row.flatMap((c) => c.blocks.filter(isHeading));
      if (headings.length) {
        const level = headings[0].match(/^#+/)[0];
        out.push(`${level} ${headings.map((h) => h.replace(/^#+\s*/, "")).join(" \u2014 ")}`);
      }
      out.push(...row.flatMap((c) => c.blocks.filter((b) => !isHeading(b))));
    }
    return out.join("\n\n");
  }

  renderTable(rows, { header }) {
    const simple =
      header &&
      rows.every((r) => r.length === rows[0].length) &&
      rows.every((r) =>
        r.every((c) => c.colSpan === 1 && c.rowSpan === 1 && c.blocks.every((b) => isInlineBlock(b)))
      );
    if (simple) {
      const line = (r) =>
        `| ${r.map((c) => c.blocks.join("<br />").replace(/\n/g, " ").replace(/(?<!\\)\|/g, "\\|") || " ").join(" | ")} |`;
      return [line(rows[0]), `| ${rows[0].map(() => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
    }
    this.usesTable = true;
    const cell = (c, th) => {
      const t = th ? "Table.Th" : "Table.Td";
      const span =
        (c.colSpan > 1 ? ` colSpan={${c.colSpan}}` : "") +
        (c.rowSpan > 1 ? ` rowSpan={${c.rowSpan}}` : "") +
        (c.nowrap ? ` style={{ whiteSpace: "nowrap" }}` : "");
      if (!c.blocks.length) return `<${t}${span} />`;
      if (c.blocks.length === 1 && isInlineBlock(c.blocks[0])) return `<${t}${span}>${c.blocks[0]}</${t}>`;
      return `<${t}${span}>\n\n${c.blocks.join("\n\n")}\n\n</${t}>`;
    };
    const tr = (r, th) => `<Table.Tr>\n${r.map((c) => cell(c, th || c.th)).join("\n")}\n</Table.Tr>`;
    const head = header ? `<thead>\n${tr(rows[0], true)}\n</thead>\n` : "";
    const body = (header ? rows.slice(1) : rows).map((r) => tr(r, false)).join("\n");
    return `<Table>\n${head}<tbody>\n${body}\n</tbody>\n</Table>`;
  }

  // --- The page --------------------------------------------------------------------------------

  convert(storage) {
    const doc = parseStorage(storage);
    const used = [1, 2, 3, 4, 5, 6].filter((n) => findAll(doc, `h${n}`).length);
    this.headingOffset = used.length ? 2 - used[0] : 1;
    return this.blocks(kids(doc));
  }

  /** A Google Doc page, already split and rewritten by `loadGdoc`: its Heading 3 is the page's ## */
  convertNodes(nodes) {
    this.headingOffset = -1;
    return this.blocks(nodes);
  }
}

/**
 * Pictures floated right appear in reverse order on the page (the first one floats rightmost), so
 * a run of them - the key legends of a combination like SHIFT TAB - is read back in reverse.
 */
function floatOrder(nodes) {
  const out = [...nodes];
  const isRight = (n) => tag(n) === "ac:image" && attr(n, "ac:align") === "right";
  const isGap = (n) => n.nodeName === "#text" && !n.value.replace(/\u00a0/g, " ").trim();
  for (let i = 0; i < out.length; i++) {
    if (!isRight(out[i])) continue;
    let j = i;
    const run = [];
    while (j < out.length && (isRight(out[j]) || isGap(out[j]))) {
      if (isRight(out[j])) run.push(out[j]);
      j++;
    }
    if (run.length > 1) out.splice(i, j - i, ...run.reverse());
    i += run.length;
  }
  return out;
}

function anchorId(name) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .toLowerCase();
}

function fence(text) {
  const body = text.replace(/ /g, " ").replace(/\r/g, "").replace(/^\n+|\s+$/g, "");
  return "```text\n" + body + "\n```";
}

function isEmpty(nodes) {
  const hasContent = (n) => {
    if (n.nodeName === "#text") return n.value.replace(/ /g, " ").trim() !== "";
    if (["ac:image", "table", "hr", "ac:structured-macro", "ac:link", "a"].includes(tag(n))) return true;
    return kids(n).some(hasContent);
  };
  return !nodes.some(hasContent);
}

/** A layout cell that reads as a label: short, and no headings, tables, lists or pictures */
function isLabel(nodes) {
  let ok = true;
  let length = 0;
  const visit = (n) => {
    const name = tag(n);
    if (n.nodeName === "#text") length += n.value.trim().length;
    else if (/^h[1-6]$/.test(name) || ["table", "ul", "ol", "pre", "ac:structured-macro"].includes(name)) ok = false;
    else if (name === "ac:image") {
      const att = findChild(n, "ri:attachment") ?? findChild(n, "ri:url");
      const file = att ? (attr(att, "ri:filename") ?? attr(att, "ri:value") ?? "") : "";
      if (!keyOf(decodeURIComponent(file.split("?")[0].split("/").pop()))) ok = false;
    } else kids(n).forEach(visit);
  };
  nodes.forEach(visit);
  return ok && length <= 60;
}

function isHeading(block) {
  return /^#{1,6} /.test(block);
}

function isInlineBlock(block) {
  return !/\n/.test(block) && !/^(<Shot|<Callout|<Table|```|#{1,6} |- |\d+\. |> |---)/.test(block);
}


// ------------------------------------------------------------------------------------------------
// Google Doc spaces (BBCREF)

/** "h.xxxx" (a heading or bookmark id of the Google Doc) -> { pageId, hash } */
const GDOC_ANCHORS = new Map();
const gdocLoads = new Map();

/** A synthetic element, shaped like the ones parse5 builds */
function el(tagName, attrs = {}, childNodes = []) {
  const node = {
    nodeName: tagName,
    tagName,
    attrs: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    childNodes
  };
  for (const c of childNodes) c.parentNode = node;
  return node;
}
const textNode = (value) => ({ nodeName: "#text", value });

/** The document's class rules -> what they mean for the converter (later rules win, as in CSS) */
function gdocStyles(html) {
  const css = html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const rules = new Map();
  let order = 0;
  for (const [, name, decl] of css.matchAll(/\.(c\d+)\{([^}]*)\}/g)) {
    const style = { order: order++ };
    const weight = decl.match(/font-weight:(\d+)/);
    if (weight) style.bold = Number(weight[1]) >= 600;
    const italic = decl.match(/font-style:(\w+)/);
    if (italic) style.italic = italic[1] === "italic";
    const font = decl.match(/font-family:"([^"]+)"/);
    if (font) style.mono = /courier|mono/i.test(font[1]);
    const valign = decl.match(/vertical-align:(\w+)/);
    if (valign) style.valign = valign[1];
    rules.set(name, style);
  }
  return (node) => {
    const style = {};
    const list = (attr(node, "class") ?? "").split(/\s+/).map((c) => rules.get(c)).filter(Boolean);
    for (const r of list.sort((a, b) => a.order - b.order)) Object.assign(style, r);
    return style;
  };
}

/** Whether a node's visible text is all inside `wrapper` elements (and there is some) */
function allInside(node, wrapper) {
  let some = false;
  const visit = (n, inside) => {
    if (n.nodeName === "#text") {
      if (n.value.replace(/ /g, " ").trim()) {
        if (!inside) return false;
        some = true;
      }
      return true;
    }
    return kids(n).every((c) => visit(c, inside || tag(c) === wrapper));
  };
  return kids(node).every((c) => visit(c, tag(c) === wrapper)) && some;
}

/**
 * Rewrites the export's markup into what PageConverter reads: styled spans -> strong / em / code /
 * sup, all-monospace paragraphs -> <pre> lines, pictures -> <ac:image>, one-column tables (the
 * Syntax / Associated Keywords boxes) -> their content, a bold first row -> table headings.
 */
function gdocRewrite(node, styleOf, ctx) {
  const name = tag(node);
  if (node.nodeName === "#text" || node.nodeName === "#comment") return [node];
  if (name === "hr" || name === "style" || name === "script") return [];
  const children = () => kids(node).flatMap((c) => gdocRewrite(c, styleOf, ctx));
  if (name === "span") {
    const style = styleOf(node);
    let out = children();
    if (style.mono) out = [el("code", {}, out)];
    if (style.valign === "super" || style.valign === "sub") out = [el(style.valign === "super" ? "sup" : "sub", {}, out)];
    if (style.italic) out = [el("em", {}, out)];
    if (style.bold) out = [el("strong", {}, out)];
    return out;
  }
  if (name === "img") {
    const file = (attr(node, "src") ?? "").split("/").pop();
    const width = Number((attr(node, "style") ?? "").match(/width:\s*([\d.]+)px/)?.[1]);
    return [
      el("ac:image", { "ac:alt": ctx.alt[file] ?? "", ...(width ? { "ac:width": String(Math.round(width)) } : {}) }, [
        el("ri:url", { "ri:value": pathToFileURL(join(ctx.dir, attr(node, "src"))).href })
      ])
    ];
  }
  if (name === "p") {
    const p = el("p", {}, children());
    // --- A paragraph in the program listing font is a listing: one <pre> per line, which the
    // --- converter joins with the listing lines next to it into one code block
    if (allInside(p, "code")) {
      const lines = textOf(p).replace(/ /g, " ").split("\n");
      if (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop();
      return lines.map((line) => el("pre", {}, [textNode(line)]));
    }
    return [p];
  }
  if (name === "table") {
    const rows = findAll(node, "tr");
    const cells = (tr) => kids(tr).filter((c) => tag(c) === "td" || tag(c) === "th");
    if (rows.every((tr) => cells(tr).length <= 1)) {
      return rows.flatMap((tr) => cells(tr).flatMap((td) => kids(td).flatMap((c) => gdocRewrite(c, styleOf, ctx))));
    }
    const newRows = rows.map((tr) =>
      el("tr", {}, cells(tr).map((td) => el("td", Object.fromEntries((td.attrs ?? []).filter((a) => /span$/.test(a.name)).map((a) => [a.name, a.value])), kids(td).flatMap((c) => gdocRewrite(c, styleOf, ctx)))))
    );
    const first = newRows[0];
    if (newRows.length > 1 && kids(first).every((td) => allInside(td, "strong"))) {
      for (const td of kids(first)) {
        td.nodeName = td.tagName = "th";
        const unwrap = (n) => kids(n).flatMap((c) => (tag(c) === "strong" ? unwrap(c) : [c]));
        td.childNodes = unwrap(td);
      }
    }
    return [el("table", {}, [el("tbody", {}, newRows)])];
  }
  const copy = el(name, Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value])), children());
  return [copy];
}

/** Text of a heading: its lines, each with its whitespace collapsed */
function headingLines(node) {
  return textOf(node)
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** A table-of-contents line: links into the document only, ending in a printed page number */
function isTocLine(node) {
  if (tag(node) !== "p") return false;
  const links = findAll(node, "a");
  return (
    links.length > 0 &&
    links.every((a) => (attr(a, "href") ?? "").startsWith("#")) &&
    /\d\s*$/.test(textOf(node).replace(/ /g, " "))
  );
}

function anchorMacro(id) {
  return el("ac:structured-macro", { "ac:name": "anchor" }, [el("ac:parameter", { "ac:name": "" }, [textNode(id)])]);
}

/**
 * Fetches the Google Doc a space's home page embeds (its zipped HTML export, cached) and splits it
 * into pages: front matter -> the area's index, Heading 1 -> a chapter, Heading 2 -> a page.
 */
async function loadGdoc(spaceKey) {
  if (gdocLoads.has(spaceKey)) return gdocLoads.get(spaceKey);
  const load = (async () => {
    const spec = SPACES[spaceKey];
    const space = await fetchJson(`${SITE}/rest/api/space/${spaceKey}`, "space.json", spaceKey);
    const homeId = space._expandable.homepage.split("/").pop();
    const home = await fetchJson(
      `${SITE}/rest/api/content/${homeId}?expand=body.storage,version`,
      `raw/${homeId}.json`,
      spaceKey
    );
    const docId = home.body.storage.value.match(/docs\.google\.com\/document\/d\/([\w-]+)/)?.[1];
    if (!docId) throw new Error(`The home page of ${spaceKey} embeds no Google Doc`);
    await fetchCached(`https://docs.google.com/document/d/${docId}/export?format=zip`, "gdoc.zip", {
      binary: true,
      space: spaceKey
    });
    const dir = join(CACHE_ROOT, spaceKey, "gdoc");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    execFileSync("unzip", ["-q", "-o", join(CACHE_ROOT, spaceKey, "gdoc.zip"), "-d", dir]);
    const htmlFile = require("node:fs").readdirSync(dir).find((f) => f.endsWith(".html"));
    const html = readFileSync(join(dir, htmlFile), "utf8");
    const body = findAll(parse5.parse(html), "body")[0];
    const styleOf = gdocStyles(html);
    const ctx = { dir, alt: spec.alt ?? {} };

    const root = { id: "root", title: spec.title, parentId: undefined, position: 0 };
    const pages = [root];
    const bodies = new Map([["root", []]]);
    let chapter;
    let current = root;
    const hashes = new Map([["root", new Set()]]);
    // --- A bookmark between two headings belongs to the page that follows it
    let marks = [];
    const open = (page) => {
      for (const mark of marks) GDOC_ANCHORS.set(mark, { pageId: page.id });
      marks = [];
      pages.push(page);
      bodies.set(page.id, []);
      hashes.set(page.id, new Set());
      current = page;
    };

    for (const raw of kids(body)) {
      const name = tag(raw);
      const id = attr(raw, "id");
      if (/^h[1-6]$/.test(name)) {
        const lines = headingLines(raw);
        if (!lines.length) continue;
        const level = Number(name[1]);
        if (level === 1) {
          chapter = { id, title: lines.join(" "), parentId: "root", position: pages.length };
          open(chapter);
          GDOC_ANCHORS.set(id, { pageId: id });
          continue;
        }
        if (level === 2 && chapter) {
          // --- "Summary<br>Trappable - Program": the page, then its first section
          open({ id, title: lines[0], parentId: chapter.id, position: pages.length });
          GDOC_ANCHORS.set(id, { pageId: id });
          if (lines.length > 1) bodies.get(id).push(el("h3", {}, [textNode(lines.slice(1).join(" "))]));
          continue;
        }
        // --- A section inside a page: a readable anchor of its own, for the links to it
        const used = hashes.get(current.id);
        let hash = anchorId(lines.join(" ")) || "section";
        while (used.has(hash)) hash += "-2";
        used.add(hash);
        if (id) GDOC_ANCHORS.set(id, { pageId: current.id, hash });
        const heading = el(level === 2 ? "h3" : name, {}, [
          anchorMacro(hash),
          ...kids(raw).flatMap((c) => gdocRewrite(c, styleOf, ctx))
        ]);
        bodies.get(current.id).push(heading);
        continue;
      }
      if (name === "a" && attr(raw, "id") && !textOf(raw).trim()) {
        marks.push(attr(raw, "id"));
        continue;
      }
      if (current === root && isTocLine(raw)) continue;
      for (const mark of findAll(raw, "a").filter((a) => attr(a, "id"))) {
        GDOC_ANCHORS.set(attr(mark, "id"), { pageId: current.id });
      }
      let nodes = gdocRewrite(raw, styleOf, ctx);
      // --- The front matter's titles ("Copyright", "Preface") are bold paragraphs
      if (current === root) {
        nodes = nodes.map((n) =>
          tag(n) === "p" && allInside(n, "strong") && textOf(n).trim().length < 30 ? el("h3", {}, kids(n)) : n
        );
        // --- The heading of the dropped table of contents goes with it
        nodes = nodes.filter((n) => !(tag(n) === "h3" && /^(table of )?contents$/i.test(textOf(n).trim())));
      }
      bodies.get(current.id).push(...nodes);
    }
    return {
      pages,
      bodies,
      version: home.version.number,
      source: `https://docs.google.com/document/d/${docId}`,
      home: `${SITE}/spaces/${spaceKey}/pages/${homeId}`
    };
  })();
  gdocLoads.set(spaceKey, load);
  return load;
}

// ------------------------------------------------------------------------------------------------
// Pictures

async function downloadPicture(image, tree, pageId) {
  let url;
  if (image.owner.url) url = image.owner.url;
  else {
    const id =
      image.owner.id ??
      (image.owner.space === SPACE_KEY
        ? [...tree.byId.values()].find((p) => p.title === image.owner.title)?.id
        : undefined) ??
      (await pageIdByTitle(image.owner.space, image.owner.title));
    if (!id) return undefined;
    url = `${SITE}/download/attachments/${id}/${encodeURIComponent(image.filename)}?api=v2`;
  }
  const cacheName = `img/${pageId}/${Buffer.from(url).toString("base64url").slice(-120)}`;
  return fetchCached(url, cacheName, { binary: true });
}

async function writePicture(buffer, target) {
  const out = join(IMAGE_DIR, target);
  mkdirSync(dirname(out), { recursive: true });
  const animated = (await sharp(buffer, { animated: true }).metadata()).pages > 1;
  const img = sharp(buffer, { animated });
  const meta = await img.metadata();
  const width = Math.min(meta.width, MAX_WIDTH);
  const info = await img
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(out);
  const height = animated ? Math.round(meta.pageHeight * (width / meta.width)) : info.height;
  writeFileSync(`${out}.json`, JSON.stringify({ width: info.width, height, markers: {} }, null, 2) + "\n");
  return { width: info.width, height };
}

// ------------------------------------------------------------------------------------------------
// Writing the area

function description(blocks) {
  const para = blocks.find((b) => isInlineBlock(b) && !b.startsWith("<") && b.length > 40) ?? "";
  const plain = para
    .replace(/<br \/>/g, " ")
    .replace(/<Key k="(\w+)" \/>/g, (_, k) => ({ diamond: "◇", square: "□" })[k] ?? k.toUpperCase())
    .replace(/<\/?[A-Za-z.]+[^>]*>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\(.)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 200 ? plain.slice(0, 197).replace(/\s+\S*$/, "") + "..." : plain;
}

function metaFile(node, isRoot) {
  const entries = [...(isRoot ? [["index", node.title]] : []), ...node.children.map((c) => [c.slug, c.title])];
  const lines = entries.map(([slug, title]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(title)}`);
  return (
    `// Generated by ${GENERATOR}: the order of the Confluence space's page tree.\n` +
    `export default {\n${lines.join(",\n")}\n};\n`
  );
}

function contentsList(node, depth = 0) {
  return node.children
    .map((c) => `${"  ".repeat(depth)}- [${escapeText(c.title)}](${c.route})\n${contentsList(c, depth + 1)}`)
    .join("");
}

async function main() {
  const report = { external: new Set(), unknown: new Set(), missing: [] };
  const gdoc = SPACES[SPACE_KEY].gdoc ? await loadGdoc(SPACE_KEY) : undefined;
  const pages = await listPages();
  const tree = buildTree(pages);
  // --- The other imported spaces' page trees, so links between the spaces stay on the site
  tree.others = {};
  for (const key of Object.keys(SPACES).filter((k) => k !== SPACE_KEY)) {
    tree.others[key] = buildTree(await listPages(key), key);
  }
  console.log(`${pages.length} pages in the space ${SPACE_KEY}.`);

  rmSync(join(CONTENT_DIR, AREA_PATH), { recursive: true, force: true });
  rmSync(join(CONTENT_DIR, `${AREA_PATH}.mdx`), { force: true });
  rmSync(IMAGE_DIR, { recursive: true, force: true });

  const widths = new Map();
  const files = [];
  for (const page of tree.byId.values()) {
    const conv = new PageConverter(page, tree, report);
    let blocks, version;
    if (gdoc) {
      blocks = conv.convertNodes(gdoc.bodies.get(page.id));
      version = gdoc.version;
    } else {
      const loaded = await loadBody(page.id);
      blocks = conv.convert(loaded.storage);
      version = loaded.version;
    }

    for (const image of conv.images) {
      if (widths.has(image.target)) continue;
      const buffer = await downloadPicture(image, tree, page.id);
      if (!buffer) {
        report.missing.push(`${page.title}: ${image.filename}`);
        widths.set(image.target, null);
        continue;
      }
      try {
        widths.set(image.target, (await writePicture(buffer, image.target)).width);
      } catch (e) {
        report.missing.push(`${page.title}: ${image.filename} (${e.message})`);
        widths.set(image.target, null);
      }
    }

    const isRoot = page === tree.root;
    const imports = [];
    if (conv.usesCallout || isRoot) imports.push("Callout");
    if (conv.usesTable) imports.push("Table");
    const source = gdoc
      ? `${gdoc.source}, embedded in ${gdoc.home}`
      : `${SITE}/spaces/${SPACE_KEY}/pages/${page.id}`;
    const head = [
      [
        "---",
        `description: ${JSON.stringify(description(blocks) || page.title)}`,
        // --- A page with child pages is its folder's index: the folder itself links to it
        // --- (The area's own index is not: it is the first entry of its sidebar, like the docs'
        // --- other areas' overview pages, because an area's index page renders without a sidebar.)
        ...(page.children.length && !isRoot ? ["asIndexPage: true"] : []),
        "---"
      ].join("\n"),
      ...(imports.length ? [`import { ${imports.join(", ")} } from 'nextra/components'`] : []),
      `{/* Imported from ${source} (${gdoc ? "wiki page " : ""}version ${version}) by ${GENERATOR} */}`,
      `# ${page.title}`
    ];
    let body = blocks;
    // --- A Google Doc chapter whose text is all in its sections lists them
    if (gdoc && !isRoot && page.children.length && !blocks.length) {
      body = [contentsList(page).trimEnd()];
    }
    if (isRoot) {
      body = [
        `<Callout type="info">\n\n${SPACES[SPACE_KEY].intro(tree.root.route)}\n\n</Callout>`,
        ...blocks,
        "## Contents",
        contentsList(tree.root).trimEnd()
      ];
    }
    files.push({ page, text: [...head, ...body].join("\n\n").replace(/\n{3,}/g, "\n\n") + "\n" });
  }

  // --- Pictures whose size was unknown at conversion time get their stored width
  for (const { page, text } of files) {
    let mdx = text.replace(/width=\{__WIDTH__(.+?)__\}/g, (_, target) => {
      const w = widths.get(target);
      return w ? `width={${w}}` : "width={600}";
    });
    // --- A picture that could not be fetched would fail the build: leave a note in its place
    const shotRe = new RegExp(`<Shot src="${AREA}/([^"]+)" alt=(".*?"|\\{".*?"\\}) width=\\{\\d+\\} />`, "g");
    mdx = mdx.replace(shotRe, (m, target) =>
      widths.get(target) === null ? `{/* Missing picture in the source: ${target} */}` : m
    );
    const route = page.route.replace("/en/", "");
    const rel = page.children.length ? `${route}/index.mdx` : `${route}.mdx`;
    const out = join(CONTENT_DIR, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, mdx);
    if (page.children.length) {
      writeFileSync(join(CONTENT_DIR, route, "_meta.ts"), metaFile(page, page === tree.root));
    }
  }

  console.log(`Wrote ${files.length} pages and ${[...widths.values()].filter(Boolean).length} pictures.`);
  if (report.missing.length) console.log(`Missing pictures:\n  ${report.missing.join("\n  ")}`);
  if (report.external.size) console.log(`Links to other spaces:\n  ${[...report.external].join("\n  ")}`);
  if (report.unknown.size) console.log(`Unhandled markup:\n  ${[...report.unknown].join("\n  ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
