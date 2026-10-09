import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { getBreakpointAddressSpec } from "@common/utils/breakpoints";
import { formatHitSpec } from "@common/utils/breakpoint-filters";
import { spriteAttrMaskOf } from "@common/utils/breakpoint-scope";
import { formatSpriteAttrList, SPRITE_ATTR_ALL } from "@common/zxnext/sprites/spriteBreakpoints";

/*
 * A breakpoint written back as `bp-set` text. Shared by `bp-list`, the disassembly's menus and the
 * automation server's `breakpoints.list` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2), so every
 * listing pastes back into `bp-set` the same way. No renderer imports.
 */

function toHexa4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * A breakpoint as `bp-set` arguments: the address spec, its kind options, the hit rule and the
 * condition. Pasted back into `bp-set` it recreates the breakpoint.
 */
export function breakpointCommandSpec(
  bp: BreakpointInfo,
  partitionLabels: Record<number, string>
): string {
  const parts = [getBreakpointAddressSpec(bp, partitionLabels)];
  if (bp.memoryRead) parts.push("-r");
  if (bp.memoryWrite) parts.push("-w");
  if (bp.ioRead) parts.push("-i");
  if (bp.ioWrite) parts.push("-o");
  if ((bp.ioRead || bp.ioWrite) && bp.ioMask !== undefined && bp.ioMask !== 0xffff) {
    parts.push(`-m $${toHexa4(bp.ioMask)}`);
  }
  if ((bp.memoryRead || bp.memoryWrite) && bp.length !== undefined && bp.length > 1) {
    parts.push(`-len ${bp.length}`);
  }
  if (bp.nextRegCopper) parts.push("-c");
  if (bp.spriteIndex !== undefined && spriteAttrMaskOf(bp) !== SPRITE_ATTR_ALL) {
    parts.push(`-attr ${formatSpriteAttrList(spriteAttrMaskOf(bp))}`);
  }
  // --- Before `-hit`/`-if`, so a listed line pastes back (§4.2)
  if (bp.oneShot && !bp.runTo) parts.push("-once");
  if (bp.logMessage) parts.push(`-log ${quoteLogTemplate(bp.logMessage)}`);
  const hitSpec = formatHitSpec(bp);
  if (hitSpec) parts.push(`-hit ${hitSpec}`);
  if (bp.condition?.trim()) parts.push(`-if ${bp.condition}`);
  return parts.join(" ");
}

/** What `bp-set` cannot say about a breakpoint: disabled, the live count, a condition's state. */
export function breakpointStatusText(bp: BreakpointInfo): string {
  const parts: string[] = [];
  if (bp.disabled) parts.push("<disabled>");
  if (bp.runTo) parts.push("<run-to target>");
  if (bp.currentHits !== undefined) parts.push(`(hits: ${bp.currentHits})`);
  if (bp.conditionInactive) parts.push(`<inactive: ${bp.conditionInactive}>`);
  if (bp.conditionError) parts.push(`<condition error: ${bp.conditionError}>`);
  if (bp.logError) parts.push(`<log template error: ${bp.logError}>`);
  return parts.join(" ");
}

/** A template as a `-log` value: double-quoted, `"` and `\` escaped (the tokenizer's escapes). */
export function quoteLogTemplate(template: string): string {
  return `"${template.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}


/**
 * What kind of access a breakpoint stops on, as the automation protocol names it
 * (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2).
 */
export function breakpointKind(bp: BreakpointInfo): string {
  if (bp.memoryRead && bp.memoryWrite) return "readwrite";
  if (bp.memoryRead) return "read";
  if (bp.memoryWrite) return "write";
  if (bp.ioRead && bp.ioWrite) return "io";
  if (bp.ioRead) return "in";
  if (bp.ioWrite) return "out";
  if (bp.nextReg !== undefined) return "nextreg";
  if (bp.copperIndex !== undefined) return "copper";
  if (bp.spriteIndex !== undefined) return "sprite";
  return "exec";
}
