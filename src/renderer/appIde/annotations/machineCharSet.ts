import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";

/*
 * How a `text` region reads on a machine (§4.7 of `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`).
 *
 * The ZX80 and ZX81 do not use ASCII: their text is in the machine's own character set, which the
 * machine registry already describes (`Zx80Chars`, `Zx81Chars`). Every other machine reads text as
 * ASCII, so this gives no decoder for it and the listing writes `.defm`.
 */
export function machineCharSetOf(
  machineId: string | undefined
): ((code: number) => string | undefined) | undefined {
  if (machineId !== MI_ZX80 && machineId !== MI_ZX81) return undefined;
  const chars = machineRegistry.find((machine) => machine.machineId === machineId)?.charSet;
  if (!chars) return undefined;
  return (code) => {
    const descriptor = chars[code];
    if (!descriptor) return undefined;
    if (descriptor.c === "token" || descriptor.c === "ctrl") return descriptor.t ? `{${descriptor.t.replace(/[()]/g, "")}}` : "·";
    if (code & 0x80 && descriptor.v) return `[${descriptor.v === "\xa0" ? " " : descriptor.v}]`;
    return descriptor.v === "\xa0" ? " " : descriptor.v;
  };
}
