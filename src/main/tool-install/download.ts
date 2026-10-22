import crypto from "crypto";
import fs from "fs";

/**
 * Downloads a tool release to a file (sjasmplus releases, z88dk releases), with progress, Cancel and
 * a sha256 of what arrived. Written against a `fetch`-shaped function so tests pass a fake.
 */
export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  headers?: { get: (key: string) => string | null };
  arrayBuffer?: () => Promise<ArrayBuffer>;
  json: () => Promise<unknown>;
}>;

export type DownloadProgress = {
  receivedBytes: number;
  /** From the response's Content-Length, or the size the caller expects; undefined when unknown. */
  totalBytes?: number;
};

export type DownloadOptions = {
  userAgent: string;
  /** Called as bytes arrive (at most once per chunk). */
  onProgress?: (progress: DownloadProgress) => void;
  /** Aborting it stops the download with a `DownloadCancelledError`. */
  signal?: AbortSignal;
  /** The size the caller expects, used for progress when the server sends no Content-Length. */
  expectedBytes?: number;
  /** Describes the server's refusal: "Cannot download <what>. Server returned 404 Not Found." */
  what?: string;
};

export type DownloadResult = { bytes: number; sha256: string };

export class DownloadCancelledError extends Error {
  constructor() {
    super("The download was cancelled.");
    this.name = "DownloadCancelledError";
  }
}

export function isDownloadCancelled(error: unknown): boolean {
  return error instanceof DownloadCancelledError || (error as { name?: string })?.name === "AbortError";
}

export async function downloadToFile(
  fetcher: FetchLike,
  url: string,
  targetFile: string,
  options: DownloadOptions
): Promise<DownloadResult> {
  const { signal } = options;
  if (signal?.aborted) throw new DownloadCancelledError();
  const what = options.what ?? "the release";

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetcher(url, {
      headers: { Accept: "application/octet-stream", "User-Agent": options.userAgent },
      signal
    });
  } catch (error) {
    if (signal?.aborted || isDownloadCancelled(error)) throw new DownloadCancelledError();
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Cannot download ${what}. Server returned ${response.status} ${response.statusText}.`);
  }

  const lengthHeader = Number(response.headers?.get("content-length") ?? "");
  const totalBytes = Number.isFinite(lengthHeader) && lengthHeader > 0 ? lengthHeader : options.expectedBytes;
  const hash = crypto.createHash("sha256");
  let receivedBytes = 0;
  const out = fs.openSync(targetFile, "w");
  try {
    const write = (chunk: Uint8Array) => {
      if (signal?.aborted) throw new DownloadCancelledError();
      fs.writeSync(out, chunk);
      hash.update(chunk);
      receivedBytes += chunk.length;
      options.onProgress?.({ receivedBytes, totalBytes });
    };

    const body = response.body as any;
    if (body && typeof body.getReader === "function") {
      // --- A web stream (Node's fetch)
      const reader = body.getReader();
      try {
        for (;;) {
          if (signal?.aborted) throw new DownloadCancelledError();
          const { done, value } = await reader.read();
          if (done) break;
          if (value) write(value);
        }
      } catch (error) {
        await reader.cancel?.().catch?.(() => undefined);
        if (signal?.aborted || isDownloadCancelled(error)) throw new DownloadCancelledError();
        throw error;
      }
    } else if (body && typeof body[Symbol.asyncIterator] === "function") {
      for await (const chunk of body as AsyncIterable<Uint8Array>) write(chunk);
    } else if (response.arrayBuffer) {
      write(new Uint8Array(await response.arrayBuffer()));
    } else {
      throw new Error(`Cannot download ${what}. The response body is empty.`);
    }
  } finally {
    fs.closeSync(out);
  }
  return { bytes: receivedBytes, sha256: hash.digest("hex") };
}
