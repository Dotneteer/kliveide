import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

/*
 * Downloading and importing a Next SD base card (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 4): only the
 * manifest's bytes are accepted, from the one host, and a failure leaves no file behind. The server is
 * a local one (D-5's test override); the card is a small stand-in the manifest is pointed at.
 */

const home = { dir: "" };
vi.mock("@main/portable", () => ({ getKliveHomeBase: () => home.dir }));

import { NEXT_ROM_SETS, type NextSdBaseImage } from "@common/zxnext/romSets";
import {
  NEXT_SD_CARDS_URL,
  NextSdCardError,
  downloadNextSdCard,
  importNextSdCard,
  nextSdCardsBaseUrl,
  type NextSdFetch
} from "@main/next-sd/downloadNextSdCard";
import { availableCard, downloadedCardPath } from "@main/next-sd/nextSdCards";

const SET = "nextzxos-2.10" as const;
const RAW = new Uint8Array(64 * 1024).map((_, i) => (i * 13) & 0xff);
const GZ = gzipSync(RAW, { level: 9 });
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

let saved: NextSdBaseImage;
let server: http.Server;
let baseUrl: string;
type Route = { status: number; body?: Buffer; headers?: Record<string, string>; cutAt?: number; hold?: boolean };
const routes = new Map<string, Route>();
const held: http.ServerResponse[] = [];
const fetcher: NextSdFetch = (url, init) => fetch(url, init);
const plenty = async () => Number.MAX_SAFE_INTEGER;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const route = routes.get(req.url ?? "") ?? { status: 404 };
    if (route.cutAt !== undefined) {
      // --- Promise the whole card, send part of it, then drop the connection
      res.writeHead(200, { "content-length": String(route.body!.length), connection: "close" });
      res.write(route.body!.subarray(0, route.cutAt));
      setTimeout(() => res.socket?.destroy(), 20);
      return;
    }
    if (route.hold) {
      // --- Send a first chunk and wait: the test cancels
      res.writeHead(200, { "content-length": String(route.body!.length), connection: "close" });
      res.write(route.body!.subarray(0, 1024));
      held.push(res);
      return;
    }
    res.writeHead(route.status, route.headers);
    res.end(route.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/next-sd/`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  home.dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-download-"));
  routes.clear();
  const entry = NEXT_ROM_SETS[SET].sdBaseImage;
  saved = { ...entry };
  Object.assign(entry, { size: RAW.length, sha256: sha(RAW), gzSize: GZ.length, gzSha256: sha(GZ) });
});
afterEach(() => {
  for (const res of held.splice(0)) res.socket?.destroy();
  Object.assign(NEXT_ROM_SETS[SET].sdBaseImage, saved);
  fs.rmSync(home.dir, { recursive: true, force: true });
});

const cardRoute = (route: Route) => routes.set(`/next-sd/${SET}.cim.gz`, route);
const noFiles = () => {
  expect(fs.existsSync(downloadedCardPath(SET))).toBe(false);
  expect(fs.existsSync(`${downloadedCardPath(SET)}.partial`)).toBe(false);
};
const failure = (promise: Promise<unknown>) => promise.then(() => undefined, (err: NextSdCardError) => err);

describe("the download address", () => {
  it("is kliveide.net, and the override counts only in a Klive that is not packaged", () => {
    const env = { KLIVE_NEXT_SD_BASE_URL: "http://127.0.0.1:1/x" };
    expect(nextSdCardsBaseUrl(true, env)).toBe(NEXT_SD_CARDS_URL);
    expect(nextSdCardsBaseUrl(false, {})).toBe("https://kliveide.net/next-sd/");
    expect(nextSdCardsBaseUrl(false, env)).toBe("http://127.0.0.1:1/x/");
  });
});

describe("downloading a card", () => {
  it("stores the published bytes where the app looks for a downloaded card, reporting progress", async () => {
    cardRoute({ status: 200, body: Buffer.from(GZ) });
    const progress: number[] = [];
    const file = await downloadNextSdCard(SET, {
      fetch: fetcher,
      baseUrl,
      freeBytes: plenty,
      onProgress: (received, total) => {
        expect(total).toBe(GZ.length);
        progress.push(received);
      }
    });
    expect(file).toBe(downloadedCardPath(SET));
    expect(gunzipSync(fs.readFileSync(file))).toEqual(Buffer.from(RAW));
    expect(progress.at(-1)).toBe(GZ.length);
    expect(availableCard(SET)).toMatchObject({ source: "downloaded", compressed: true });
  });

  it("refuses bytes that are not the manifest's", async () => {
    cardRoute({ status: 200, body: gzipSync(RAW.map((b) => b ^ 1)) });
    const err = await failure(downloadNextSdCard(SET, { fetch: fetcher, baseUrl, freeBytes: plenty }));
    expect(err).toMatchObject({ kind: "wrongCard" });
    noFiles();
  });

  it("refuses a body cut short", async () => {
    cardRoute({ status: 200, body: Buffer.from(GZ), cutAt: GZ.length >> 1 });
    const err = await failure(downloadNextSdCard(SET, { fetch: fetcher, baseUrl, freeBytes: plenty }));
    expect(err).toBeInstanceOf(NextSdCardError);
    expect(["network", "wrongCard"]).toContain(err!.kind);
    noFiles();
  });

  it("stops reading a body larger than the card", async () => {
    cardRoute({ status: 200, body: Buffer.concat([Buffer.from(GZ), Buffer.alloc(100)]) });
    const err = await failure(downloadNextSdCard(SET, { fetch: fetcher, baseUrl, freeBytes: plenty }));
    expect(err).toMatchObject({ kind: "tooLarge" });
    noFiles();
  });

  it("is cancelled through its signal", async () => {
    cardRoute({ status: 200, body: Buffer.from(GZ), hold: true });
    const abort = new AbortController();
    const download = failure(
      downloadNextSdCard(SET, {
        fetch: fetcher,
        baseUrl,
        freeBytes: plenty,
        signal: abort.signal,
        onProgress: () => abort.abort()
      })
    );
    expect(await download).toMatchObject({ kind: "cancelled" });
    noFiles();
  });

  it("follows no redirect: the card comes from the one host", async () => {
    cardRoute({ status: 302, headers: { location: "https://example.com/card.cim.gz" } });
    const err = await failure(downloadNextSdCard(SET, { fetch: fetcher, baseUrl, freeBytes: plenty }));
    expect(err).toMatchObject({ kind: "redirected", detail: 302 });
    noFiles();
  });

  it("names the HTTP status of a card that is not there", async () => {
    const err = await failure(downloadNextSdCard(SET, { fetch: fetcher, baseUrl, freeBytes: plenty }));
    expect(err).toMatchObject({ kind: "http", detail: 404 });
  });

  it("refuses a card the server re-encoded", async () => {
    cardRoute({ status: 200, body: Buffer.from(GZ), headers: { "content-encoding": "br" } });
    const err = await failure(downloadNextSdCard(SET, { fetch: fetcher, baseUrl, freeBytes: plenty }));
    expect(err).toMatchObject({ kind: "encoded" });
  });

  it("does not start without room for the card and its working copy", async () => {
    cardRoute({ status: 200, body: Buffer.from(GZ) });
    const err = await failure(downloadNextSdCard(SET, { fetch: fetcher, baseUrl, freeBytes: async () => 1000 }));
    expect(err).toMatchObject({ kind: "noSpace", detail: GZ.length + RAW.length });
    noFiles();
  });

  it("names a server it cannot reach", async () => {
    const err = await failure(
      downloadNextSdCard(SET, { fetch: fetcher, baseUrl: "http://127.0.0.1:1/next-sd/", freeBytes: plenty })
    );
    expect(err).toMatchObject({ kind: "network" });
  });
});

describe("importing a card downloaded elsewhere", () => {
  const put = (name: string, bytes: Uint8Array) => {
    const file = path.join(home.dir, name);
    fs.writeFileSync(file, bytes);
    return file;
  };

  it("takes the published .gz as it is", async () => {
    const file = await importNextSdCard(SET, put("card.cim.gz", GZ), plenty);
    expect(new Uint8Array(fs.readFileSync(file))).toEqual(new Uint8Array(GZ));
  });

  it("takes a .gz packed by another tool when it holds the card", async () => {
    const other = gzipSync(RAW, { level: 1 });
    const file = await importNextSdCard(SET, put("other.gz", other), plenty);
    expect(gunzipSync(fs.readFileSync(file))).toEqual(Buffer.from(RAW));
  });

  it("gzips a raw card", async () => {
    const file = await importNextSdCard(SET, put("card.cim", RAW), plenty);
    expect(file).toBe(downloadedCardPath(SET));
    expect(gunzipSync(fs.readFileSync(file))).toEqual(Buffer.from(RAW));
  });

  it("refuses another card, and keeps nothing", async () => {
    const err = await failure(importNextSdCard(SET, put("wrong.cim", RAW.map((b) => b ^ 2)), plenty));
    expect(err).toMatchObject({ kind: "wrongCard" });
    noFiles();
  });

  it("refuses a .gz that is cut short", async () => {
    const err = await failure(importNextSdCard(SET, put("cut.cim.gz", GZ.subarray(0, GZ.length - 50)), plenty));
    expect(err).toMatchObject({ kind: "unreadable" });
    noFiles();
  });
});
