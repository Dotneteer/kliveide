/**
 * The keyboard height for a machine (issue #1377): its own if it has one, otherwise the height
 * last set on any machine. The settings file is not trusted to hold the right shape.
 */
export function keyboardHeightFor(
  heights: unknown,
  machineId: string | undefined,
  fallback: string | undefined
): string | undefined {
  const own = machineId && isHeightMap(heights) ? heights[machineId] : undefined;
  return typeof own === "string" && own ? own : fallback;
}

export function isHeightMap(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
