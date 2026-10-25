import { describe, it } from "vitest";

import { checkSnapshot } from "./snapshot-kit";

describe("shared back end: output snapshot", () => {
  it("compiles the corpus at level 3 to the recorded output", () => checkSnapshot(3), 600_000);
});
