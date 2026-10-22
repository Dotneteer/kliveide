/*
 * The Z88DK integration dialog's messages (`.plans/Z88DK_INTEGRATION_PLAN.md` §4). Shaped like
 * `SjasmplusIntegration.ts`; the differences are an install *folder* instead of an executable, a
 * supported-version mark (decision C3), and a download that reports progress and can be cancelled.
 */
export type Z88dkIntegrationScope = "user" | "project";

export type Z88dkReleasePlatform = "windows" | "macos" | "linux" | "unknown";

/** `source`: the source tarball, which needs building. */
export type Z88dkReleaseAssetKind = "binary" | "source";

export type Z88dkReleaseAsset = {
  name: string;
  downloadUrl: string;
  size: number;
  kind: Z88dkReleaseAssetKind;
  platform: Z88dkReleasePlatform;
  /** GitHub's `sha256:<hex>` digest, when it gives one (v2.4 and newer). */
  digest?: string;
  compatible: boolean;
};

export type Z88dkRelease = {
  tagName: string;
  name: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  /** The tag is in the supported range (C3). */
  supported: boolean;
  assets: Z88dkReleaseAsset[];
  compatibleAssets: Z88dkReleaseAsset[];
};

export type Z88dkReleaseListResult = {
  /** Supported releases first, newest first within each group. */
  releases: Z88dkRelease[];
  suggestedRelease?: Z88dkRelease;
  suggestedAsset?: Z88dkReleaseAsset;
  targetPlatform: Z88dkReleasePlatform;
};

export type Z88dkReleaseDownloadRequest = {
  releaseTag: string;
  asset: Z88dkReleaseAsset;
  destinationFolder: string;
};

/** What a download is doing now; polled by the dialog while it runs. */
export type Z88dkDownloadProgress = {
  phase: "idle" | "downloading" | "verifying" | "extracting" | "testing";
  receivedBytes: number;
  totalBytes?: number;
};

export type Z88dkProbeResult = {
  ok: boolean;
  /** The install folder (`<root>/bin/zcc`, `<root>/lib/config`). */
  root?: string;
  zccPath?: string;
  /** As zcc prints it: `v23854-4d530b6eb7-20251002`. */
  version?: string;
  build?: number;
  /** The build is in the supported range (C3). Undefined while the version is unknown. */
  supported?: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
};

export type Z88dkReleaseDownloadResult = Z88dkProbeResult & {
  releaseTag?: string;
  assetName?: string;
  /** The user pressed Cancel: nothing was installed, and nothing is reported as a failure. */
  cancelled?: boolean;
};

export type Z88dkIntegrationApplyRequest = {
  scope: Z88dkIntegrationScope;
  root: string;
  version?: string;
};
