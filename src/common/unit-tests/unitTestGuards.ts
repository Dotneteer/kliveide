import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { UnitTestAddress, UnitTestLabels } from "./discovery";

/*
 * The breakpoints a unit test runs under (`.plans/Z80_UNIT_TESTS_PLAN.md` D9, D12, T8): owned by
 * `unitTest`, so they never reach the Breakpoints panel or a project file, and each names its purpose
 * in `resource`, which no user breakpoint has. Shared by the headless runner and the emulator's
 * Debug-a-test flow, so both classify a stop the same way.
 */

/** Why a unit-test breakpoint is there */
export type UnitTestGuardPurpose = "init" | "start" | "success" | "returned" | "overflow" | "underflow";

const PREFIX = "<unit-test:";

/** One unit-test breakpoint */
export function unitTestGuard(
  purpose: UnitTestGuardPurpose,
  at: UnitTestAddress,
  kind: Partial<BreakpointInfo>
): BreakpointInfo {
  return {
    owner: { kind: "unitTest" },
    address: at.address & 0xffff,
    ...(at.partition !== undefined ? { partition: at.partition } : {}),
    resource: `${PREFIX}${purpose}>`,
    ...kind
  };
}

/** The purpose of a unit-test breakpoint; `undefined` for any other */
export function unitTestGuardPurpose(bp: BreakpointInfo | undefined): UnitTestGuardPurpose | undefined {
  if (bp?.owner?.kind !== "unitTest" || !bp.resource?.startsWith(PREFIX)) return undefined;
  return bp.resource.slice(PREFIX.length, -1) as UnitTestGuardPurpose;
}

/**
 * The breakpoints a test runs under: the success loop, the return of a test that used RET, and the
 * stack guards when the program has the stack labels
 */
export function testRunGuards(labels: UnitTestLabels): BreakpointInfo[] {
  const guards: BreakpointInfo[] = [unitTestGuard("success", labels.success, { exec: true })];
  const returnedAt = (labels.callAddr.address + 3) & 0xffff;
  if (returnedAt !== labels.success.address) {
    guards.push(unitTestGuard("returned", { address: returnedAt, partition: labels.callAddr.partition }, { exec: true }));
  }
  if (labels.stackBottom && labels.stackTop) {
    guards.push(
      unitTestGuard("overflow", labels.stackBottom, { memoryRead: true, length: 2 }),
      unitTestGuard("overflow", labels.stackBottom, { memoryWrite: true, length: 2 }),
      unitTestGuard("underflow", labels.stackTop, { memoryRead: true, length: 2 }),
      unitTestGuard("underflow", labels.stackTop, { memoryWrite: true, length: 2 })
    );
  }
  return guards;
}

/** The message of a stop a unit-test breakpoint caused; `undefined` for the start stop */
export function unitTestStopMessage(
  purpose: UnitTestGuardPurpose,
  testLabel: string,
  labels: UnitTestLabels,
  pc: number
): string | undefined {
  const hex = (v: number) => (v & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  switch (purpose) {
    case "success":
      return `${testLabel} passed`;
    case "returned":
      return `${testLabel} returned with RET; end a test with TC_END.`;
    case "overflow":
      return `Stack overflow: ${testLabel} used the whole test stack (UNITTEST_STACK_BOTTOM, $${hex(labels.stackBottom?.address ?? 0)}), PC $${hex(pc)}.`;
    case "underflow":
      return `Stack underflow: ${testLabel} popped more than it pushed (UNITTEST_STACK, $${hex(labels.stackTop?.address ?? 0)}), PC $${hex(pc)}.`;
    default:
      return undefined;
  }
}
