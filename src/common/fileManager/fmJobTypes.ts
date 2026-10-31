import type { FmFileSystem, FmPlanItem, FmTransferOptions } from "./fmTransfer";
import type { FmErrorCode } from "./fmTypes";

/*
 * The File Manager's jobs as MainApi carries them (.plans/FILE_MANAGER_PLAN.md §5.2): a copy or move
 * is planned first (`fmPlanTransfer`), its conflicts answered, then run (`fmRunTransfer`) while the
 * renderer reads its progress (`fmJobStatus`) and may cancel it (`fmCancelJob`).
 */

export type FmTransferRequest = {
  sourceDriveId: string;
  /** The chosen files and folders on the source drive */
  paths: string[];
  targetDriveId: string;
  /** The folder of the target drive they go to */
  targetDir: string;
  move: boolean;
  options: FmTransferOptions;
};

export type FmTransferPlan = {
  /** The job's id, for running, watching and cancelling it */
  id: string;
  move: boolean;
  from: FmFileSystem;
  to: FmFileSystem;
  items: FmPlanItem[];
  skippedFolders: string[];
  /** What the files take on the target, rounded to its blocks */
  needBytes: number;
  freeBytes?: number;
  fits: boolean;
};

/** The answer to one conflict */
export type FmConflictDecision = { kind: "replace" } | { kind: "skip" } | { kind: "rename"; name: string };

export type FmJobStatus = {
  state: "planned" | "running" | "done";
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  /** The file being written */
  current?: string;
};

export type FmJobResult = {
  written: number;
  skipped: number;
  failed: { name: string; code: FmErrorCode }[];
  cancelled: boolean;
  /** Why the job stopped before its end (a full disk) */
  aborted?: FmErrorCode;
  /** A move: sources that could not be removed after their copy */
  removeFailed?: number;
};

export type FmDeleteResult = {
  deleted: number;
  failed: { name: string; code: FmErrorCode }[];
};
