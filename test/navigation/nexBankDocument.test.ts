import { describe, expect, it } from "vitest";

import {
  nexBankDumpId,
  nexBankDumpTitle,
  nexLayer2ScreenDumpTitle
} from "@renderer/appIde/DocumentPanels/Next/nexBankDocument";

describe("NEX bank documents", () => {
  it("key a bank by the NEX's full path", () => {
    expect(nexBankDumpId("/project/Game.nex", 5)).toBe("bankDump/project/Game.nex:5");
  });

  it("title a bank the same way whoever opens it: project-relative inside the project", () => {
    expect(nexBankDumpTitle("/project/build/Game.nex", 5, "/project")).toBe("build/Game.nex - Bank: 5");
    expect(nexBankDumpTitle("/project/build/Game.nex", 5, "/project/")).toBe("build/Game.nex - Bank: 5");
    expect(nexLayer2ScreenDumpTitle("/project/Game.nex", "/project")).toBe("Game.nex - Layer2");
  });

  it("title a bank by its full path outside the project, or without one", () => {
    expect(nexBankDumpTitle("/elsewhere/Game.nex", 2, "/project")).toBe("/elsewhere/Game.nex - Bank: 2");
    expect(nexBankDumpTitle("/project-two/Game.nex", 2, "/project")).toBe("/project-two/Game.nex - Bank: 2");
    expect(nexBankDumpTitle("/p/Game.nex", 2)).toBe("/p/Game.nex - Bank: 2");
  });

  it("compares Windows paths by their forward-slash form", () => {
    expect(nexBankDumpTitle("C:\\Proj\\Game.nex", 1, "C:\\Proj")).toBe("Game.nex - Bank: 1");
  });
});
