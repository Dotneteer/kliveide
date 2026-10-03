import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { annotationStateKey, commentKindOf } from "@common/utils/source-annotations";

/*
 * The disabled state of the breakpoints `LOGPOINT`, `ASSERTION` and `WPMEM` comments create
 * (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` S3, §4.4): held by the IDE for the session, keyed
 * `resource:line:kind`, and re-applied at every install - so it survives rebuilds while the comment
 * stays on its line. Never written to disk: a restart of Klive enables them all again (Q2).
 */

const disabledComments = new Set<string>();

/** The session key of a comment-made breakpoint, or `undefined` for any other. */
export function annotationStateKeyOf(bp: BreakpointInfo): string | undefined {
  const kind = commentKindOf(bp);
  if (!kind || !bp.resource || bp.line === undefined) return undefined;
  return annotationStateKey(bp.resource, bp.line, kind);
}

/** Did the user disable this comment this session? */
export function isCommentDisabled(key: string): boolean {
  return disabledComments.has(key);
}

/**
 * Enable or disable the breakpoints of comments (every definition a comment made: each macro
 * expansion, both halves of a `WPMEM ... rw`), remembering it for later builds.
 */
export async function setCommentBreakpointsEnabled(
  emuApi: { enableBreakpoint(bp: BreakpointInfo, enabled: boolean): Promise<boolean> },
  bps: BreakpointInfo[],
  enabled: boolean
): Promise<void> {
  for (const bp of bps) {
    const key = annotationStateKeyOf(bp);
    if (!key) continue;
    if (enabled) disabledComments.delete(key);
    else disabledComments.add(key);
    await emuApi.enableBreakpoint(bp, enabled);
  }
}

/** Test support: forget every disabled comment. */
export function resetCommentStateForTests(): void {
  disabledComments.clear();
}
