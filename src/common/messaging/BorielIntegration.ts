/**
 * What crosses IPC for the Boriel BASIC setup (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3). All
 * plain data; the discriminated unions use string tags (`kind`), which this project's
 * `strictNullChecks: false` build can narrow.
 */

/** The setup kit this Klive carries for the running platform. */
export type BorielBundledKit =
  | { kind: "available"; version: string; file: string; platformKey: string }
  | { kind: "unavailable"; platformKey: string; reason: string };

/** What `zxbc --version` said about an executable. */
export type BorielProbeResult = {
  ok: boolean;
  executablePath: string;
  /** e.g. "2.0.0-beta25" */
  version?: string;
  error?: string;
};

/** The Boriel BASIC the settings point at, checked against the disk. */
export type BorielInstallation =
  | { kind: "notConfigured" }
  | {
      kind: "working";
      folder: string;
      executablePath: string;
      version: string;
      /** Older than the bundled kit, so the dialog offers "Update". */
      outdated: boolean;
    }
  | { kind: "broken"; folder: string; executablePath: string; error: string };

export type BorielSetupStatus = {
  kit: BorielBundledKit;
  installation: BorielInstallation;
  /** Where a new installation goes unless the user picks another folder (`~/zxbasic2`). */
  defaultFolder: string;
  /** The user chose "Don't ask again" for this kit version. */
  declined: boolean;
};

export type BorielInstallRequest = { folder: string };

export type BorielInstallResult =
  | { kind: "installed"; folder: string; executablePath: string; version: string; replacedPath?: string }
  | { kind: "failed"; folder: string; error: string };

/** "declined": don't offer this kit version again. "postponed": ask at the next start. */
export type BorielSetupDecision = "declined" | "postponed";
