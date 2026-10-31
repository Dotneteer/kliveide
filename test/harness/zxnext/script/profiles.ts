import { describe } from "vitest";

import { NEXT_PROFILE_IDS, type NextProfileId } from "@emu/machines/zxNext/nextProfiles";

/**
 * The profiles a version-sensitive test runs on (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` P4): one
 * `describe` per profile, so a test states which models it covers. A version-sensitive test that
 * runs only one profile is a review smell.
 *
 *   forEachProfile(NEXT_PROFILE_IDS, (profile) => {
 *     it("...", async () => { const s = await createSession({ profile }); ... });
 *   });
 *
 * Vitest only: the visual-test runner does not load this file.
 */
export function forEachProfile(
  profiles: readonly NextProfileId[] = NEXT_PROFILE_IDS,
  body: (profile: NextProfileId) => void
): void {
  for (const profile of profiles) describe(profile, () => body(profile));
}
