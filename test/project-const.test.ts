import { describe, expect, it } from "vitest";

import { KLIVE_PROJECT_ROOT } from "@common/structs/project-const";

describe("project constants", () => {
  it("uses the user's KliveProjects folder as the default project parent", () => {
    expect(KLIVE_PROJECT_ROOT).toBe("KliveProjects");
  });
});
