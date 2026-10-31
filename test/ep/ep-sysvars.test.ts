import { describe, expect, it } from "vitest";

import { SysVarType } from "@abstractions/SysVar";
import { epSysVars } from "@emu/machines/enterprise/EpSysVars";

/*
 * The EXOS system variables at the top of the system segment (`EpSysVars.ts`).
 */

const sizeOf = (type: SysVarType, length?: number) =>
  type === SysVarType.Word ? 2 : type === SysVarType.Array ? (length ?? 0) : 1;

describe("Enterprise EXOS system variables", () => {
  it("has a name, a description and a known type for each", () => {
    for (const v of epSysVars) {
      expect(v.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(v.description?.length).toBeGreaterThan(0);
      expect([SysVarType.Byte, SysVarType.Word, SysVarType.Flags, SysVarType.Array]).toContain(v.type);
    }
  });

  it("has unique names", () => {
    expect(new Set(epSysVars.map((v) => v.name)).size).toBe(epSysVars.length);
  });

  it("lies in BFEDh-BFFFh, in address order, without overlaps or gaps", () => {
    let next = 0xbfed;
    for (const v of epSysVars) {
      expect(v.address).toBe(next);
      next = v.address + sizeOf(v.type, v.length);
    }
    expect(next).toBe(0xc000);
  });

  it("puts the documented variables where the specification does", () => {
    const at = Object.fromEntries(epSysVars.map((v) => [v.name, v.address]));
    expect(at).toMatchObject({
      USER_ISR: 0xbfed,
      CRDISP_FLAG: 0xbfef,
      SEC_COUNTER: 0xbff0,
      FLAG_SOFT_IRQ: 0xbff2,
      PORTB5: 0xbff3,
      LP_POINTER: 0xbff4,
      ST_POINTER: 0xbff6,
      RST_ADDR: 0xbff8,
      STACK_LIMIT: 0xbffa,
      USR_P0: 0xbffc,
      USR_P1: 0xbffd,
      USR_P2: 0xbffe,
      USR_P3: 0xbfff
    });
    expect(epSysVars.find((v) => v.name === "LP_POINTER")?.type).toBe(SysVarType.Word);
  });
});
