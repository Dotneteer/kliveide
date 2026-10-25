import { describe, it } from "vitest";

import { checkSnapshot } from "./snapshot-kit";

describe("shared back end: output snapshot", () => {
  it("compiles the corpus at level 2 to the recorded output", () => checkSnapshot(2), 600_000);
});
