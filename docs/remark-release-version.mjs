// Replaces @KLIVE_RELEASE@ in the docs with the latest release's version (0.64.0), so no page has
// to hard-code a release (D8 of .plans/RELEASE_AUTOMATION_PLAN.md). The version comes from
// docs/generated/site-info.json, which scripts/build-doc-site-info.cjs writes from the newest v*
// tag before every docs build; a release redeploys the site, so the pages follow by themselves.
//
// It works in code fences, inline code, prose and link targets - the places a download URL or a
// version can appear. The page's raw source (Nextra's "Copy page") is not in the tree; the page
// route replaces the token there with replaceReleaseToken(). scripts/check-docs-release-links.cjs fails the build on a hard-coded release
// URL in content/ and on a token that survived into the built pages.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const RELEASE_TOKEN = "@KLIVE_RELEASE@";

/** The latest release's version, as the site shows it */
export function latestRelease() {
  // --- Paths from the working directory (docs/, as for every docs script), not import.meta.url:
  // --- the page route imports this module too, and webpack's server bundle rewrites import.meta
  const siteInfo = join(process.cwd(), "generated", "site-info.json");
  if (existsSync(siteInfo)) {
    const version = JSON.parse(readFileSync(siteInfo, "utf8")).latestRelease;
    if (version && version !== "0.0.0") return version;
  }
  // --- No site info yet (a bare `next dev`): the version of the checkout is the best guess
  return JSON.parse(readFileSync(join(process.cwd(), "..", "package.json"), "utf8")).version;
}

/** Replaces the token in a string (the page route uses it on the raw source) */
export function replaceReleaseToken(text, version = latestRelease()) {
  return typeof text === "string" ? text.split(RELEASE_TOKEN).join(version) : text;
}

export default function remarkReleaseVersion() {
  const version = latestRelease();
  const walk = (node) => {
    if (typeof node.value === "string" && node.value.includes(RELEASE_TOKEN)) {
      node.value = node.value.split(RELEASE_TOKEN).join(version);
    }
    if (typeof node.url === "string" && node.url.includes(RELEASE_TOKEN)) {
      node.url = node.url.split(RELEASE_TOKEN).join(version);
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  return walk;
}
