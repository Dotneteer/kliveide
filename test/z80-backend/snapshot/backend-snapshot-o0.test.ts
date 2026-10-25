import { describe, it } from "vitest";

import { checkSnapshot } from "./snapshot-kit";

describe("shared back end: output snapshot", () => {
  it("compiles the corpus at level 0 to the recorded output", () => checkSnapshot(0), 600_000);
});
