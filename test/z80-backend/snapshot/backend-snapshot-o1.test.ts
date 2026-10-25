import { describe, it } from "vitest";

import { checkSnapshot } from "./snapshot-kit";

describe("shared back end: output snapshot", () => {
  it("compiles the corpus at level 1 to the recorded output", () => checkSnapshot(1), 600_000);
});
