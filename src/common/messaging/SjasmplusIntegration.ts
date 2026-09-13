export type SjasmplusIntegrationScope = "user" | "project";

export type SjasmplusReleasePlatform = "windows" | "macos" | "linux" | "unknown";

export type SjasmplusReleaseArch = "x64" | "arm64" | "x86" | "unknown";

// --- "source" marks the source archives upstream ships alongside binaries; they
// --- hold C++ sources, not a runnable assembler.
export type SjasmplusReleaseAssetKind = "binary" | "source";

export type SjasmplusReleaseAsset = {
  name: string;
  downloadUrl: string;
  size: number;
  kind: SjasmplusReleaseAssetKind;
  platform: SjasmplusReleasePlatform;
  arch: SjasmplusReleaseArch;
  compatible: boolean;
};

export type SjasmplusRelease = {
  tagName: string;
  name: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  assets: SjasmplusReleaseAsset[];
  compatibleAssets: SjasmplusReleaseAsset[];
};

export type SjasmplusReleaseListRequest = {
  includePrereleases?: boolean;
};

export type SjasmplusReleaseListResult = {
  releases: SjasmplusRelease[];
  suggestedRelease?: SjasmplusRelease;
  suggestedAsset?: SjasmplusReleaseAsset;
  // --- The platform the compatibility check ran against, so the UI can explain
  // --- why a release offers nothing usable here.
  targetPlatform: SjasmplusReleasePlatform;
};

export type SjasmplusReleaseDownloadRequest = {
  releaseTag: string;
  asset: SjasmplusReleaseAsset;
  destinationFolder: string;
};

export type SjasmplusProbeResult = {
  ok: boolean;
  executablePath?: string;
  installFolder?: string;
  version?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
};

export type SjasmplusReleaseDownloadResult = SjasmplusProbeResult & {
  releaseTag?: string;
  assetName?: string;
};

export type SjasmplusIntegrationApplyRequest = {
  scope: SjasmplusIntegrationScope;
  installFolder: string;
  executablePath: string;
  version?: string;
};
