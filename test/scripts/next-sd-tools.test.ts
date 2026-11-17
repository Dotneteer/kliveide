import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";

import { NEXT_ROM_SETS } from "@common/zxnext/romSets";

/*
 * The developer tools for the Next's SD base cards (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 3):
 * downloads are accepted only with the manifest's hashes and leave nothing behind when they fail, and
 * a card is published onto a `gh-pages` branch without a checkout, never rewritten, at most five.
 * The server is a local one (`KLIVE_NEXT_SD_BASE_URL`), the remote a throwaway bare repository
 * (`KLIVE_NEXT_SD_REMOTE`). The publishing tests need the published 26.11 `.gz` (`next-sd:fetch` puts
 * it in `.local/next-sd/` once the card is on the site) and are skipped without it.
 */

const ROOT = path.join(__dirname, "../..");
const cards = createRequire(__filename)(path.join(ROOT, "dev/scripts/next-sd/cards.cjs"));
const SET = "nextzxos-26.11" as const;
const card = NEXT_ROM_SETS[SET].sdBaseImage;
const publishedGz = path.join(ROOT, ".local/next-sd", `${SET}.cim.gz`);
const hasPublishedGz = fs.existsSync(publishedGz) && fs.statSync(publishedGz).size === card.gzSize;

let dir: string;
let server: http.Server;
const routes = new Map<string, { status: number; body?: Buffer; headers?: Record<string, string> }>();

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-tools-"));
  server = http.createServer((req, res) => {
    const route = routes.get(req.url ?? "") ?? { status: 404 };
    res.writeHead(route.status, route.headers);
    res.end(req.method === "HEAD" ? undefined : route.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.KLIVE_NEXT_SD_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/next-sd/`;
});
afterAll(async () => {
  delete process.env.KLIVE_NEXT_SD_BASE_URL;
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("downloading a published card", () => {
  it("refuses bytes that are not the manifest's, and leaves no file", async () => {
    routes.set(`/next-sd/${SET}.cim.gz`, { status: 200, body: gzipSync(Buffer.from("not a card")) });
    const target = path.join(dir, "wrong.cim.gz");
    await expect(cards.downloadGz(SET, target, card)).rejects.toThrow(/the manifest pins/);
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(`${target}.partial`)).toBe(false);
  });

  it("names the HTTP status of a card that is not there", async () => {
    routes.delete(`/next-sd/${SET}.cim.gz`);
    await expect(cards.downloadGz(SET, path.join(dir, "none.cim.gz"), card)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a card the server re-encoded", async () => {
    routes.set(`/next-sd/${SET}.cim.gz`, { status: 200, body: Buffer.alloc(10), headers: { "content-encoding": "gzip" } });
    await expect(cards.downloadGz(SET, path.join(dir, "enc.cim.gz"), card)).rejects.toThrow(/re-encoded/);
  });

  it.skipIf(!hasPublishedGz)("accepts the published card and decompresses it to the raw card", async () => {
    routes.set(`/next-sd/${SET}.cim.gz`, { status: 200, body: fs.readFileSync(publishedGz) });
    const gz = path.join(dir, `${SET}.cim.gz`);
    await cards.downloadGz(SET, gz, card);
    const raw = path.join(dir, `${SET}-base.cim`);
    const facts = await cards.gunzipCard(gz, raw, card);
    expect(facts).toEqual({ size: card.size, sha256: card.sha256 });
  });

  it.skipIf(!hasPublishedGz)("next-sd:fetch downloads into its folder", async () => {
    routes.set(`/next-sd/${SET}.cim.gz`, { status: 200, body: fs.readFileSync(publishedGz) });
    const local = path.join(dir, "fetch");
    // --- Not spawnSync: the server answers from this very process
    const result = await promisify(execFile)(process.execPath, [path.join(ROOT, "dev/scripts/next-sd-fetch.cjs"), SET], {
      env: { ...process.env, KLIVE_NEXT_SD_LOCAL: local },
      encoding: "utf8"
    });
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${SET}: downloaded http://127.0.0.1`);
    expect(fs.statSync(path.join(local, `${SET}-base.cim`)).size).toBe(card.size);
  });
});

describe.skipIf(!hasPublishedGz)("publishing a card onto gh-pages", () => {
  let remote: string;
  const git = (args: string[], cwd = remote) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const publish = (...args: string[]) =>
    spawnSync(process.execPath, [path.join(ROOT, "dev/scripts/next-sd-publish.cjs"), SET, ...args], {
      env: { ...process.env, KLIVE_NEXT_SD_REMOTE: remote },
      encoding: "utf8"
    });

  beforeAll(() => {
    // --- A bare remote with a gh-pages branch that holds a site page and four other cards
    remote = path.join(dir, "remote.git");
    git(["init", "--bare", "-b", "gh-pages", remote], dir);
    const work = path.join(dir, "work");
    git(["init", "-b", "gh-pages", work], dir);
    fs.writeFileSync(path.join(work, "index.html"), "site");
    fs.mkdirSync(path.join(work, "next-sd"));
    for (const n of [1, 2, 3, 4]) fs.writeFileSync(path.join(work, "next-sd", `old-${n}.cim.gz`), `card ${n}`);
    git(["add", "."], work);
    git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-m", "site"], work);
    git(["push", remote, "gh-pages"], work);
  });

  it("shows what it would push without --push, and pushes nothing", () => {
    const before = git(["rev-parse", "gh-pages"]);
    const result = publish();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("would push");
    expect(git(["rev-parse", "gh-pages"])).toBe(before);
  });

  it("adds the card on top of the branch, keeping the site", () => {
    const before = git(["rev-parse", "gh-pages"]);
    expect(publish("--push").status).toBe(0);
    expect(git(["rev-parse", "gh-pages~1"])).toBe(before);
    expect(git(["diff", "--name-only", before, "gh-pages"])).toBe(`next-sd/${SET}.cim.gz`);
    expect(git(["cat-file", "-s", `gh-pages:next-sd/${SET}.cim.gz`])).toBe(String(card.gzSize));
  });

  it("does nothing for a card that is already published", () => {
    const before = git(["rev-parse", "gh-pages"]);
    const result = publish("--push");
    expect(result.stdout).toContain("already published");
    expect(git(["rev-parse", "gh-pages"])).toBe(before);
  });

  it("refuses a sixth card", () => {
    // --- Five cards are on the branch now: replace ours by another name, so it would be the sixth
    const work = path.join(dir, "work");
    git(["pull", remote, "gh-pages"], work);
    git(["mv", `next-sd/${SET}.cim.gz`, "next-sd/old-5.cim.gz"], work);
    git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-m", "five"], work);
    git(["push", remote, "gh-pages"], work);
    const result = publish("--push");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("at most 5");
  });
});

describe("the default Next model the developer tools read", () => {
  it("is the one nextProfiles.ts names, with its working copy and ROM set", async () => {
    const { NEW_PROJECT_NEXT_PROFILE_ID, nextProfileOf } = await import("@emu/machines/zxNext/nextProfiles");
    const profile = nextProfileOf(NEW_PROJECT_NEXT_PROFILE_ID);
    expect(cards.defaultNextModel()).toEqual({ id: profile.id, workingCopy: profile.sdWorkingCopy, romSet: profile.romSet });
  });
});
