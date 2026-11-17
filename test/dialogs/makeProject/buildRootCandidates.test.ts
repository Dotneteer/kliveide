import { describe, expect, it } from "vitest";

import { buildRootCandidatesOf } from "@renderer/appIde/dialogs/makeProject/buildRootCandidates";

describe("buildRootCandidatesOf", () => {
  it("collects the files that can be a build root, folder-relative", () => {
    const node = (data: object, children: object[] = []) => ({
      data,
      forEachDescendant(action: (n: unknown) => void) {
        for (const child of children as any[]) {
          action(child);
          child.forEachDescendant(action);
        }
      }
    });
    const root = node({ isFolder: true, name: "game" }, [
      node({ isFolder: false, name: "main.bas", projectPath: "main.bas", canBeBuildRoot: true }),
      node({ isFolder: false, name: "notes.txt", projectPath: "notes.txt", canBeBuildRoot: false }),
      node({ isFolder: true, name: "src", projectPath: "src", canBeBuildRoot: false }, [
        node({ isFolder: false, name: "lib.bas", projectPath: "/src/lib.bas", canBeBuildRoot: true })
      ])
    ]);

    expect(buildRootCandidatesOf({ rootNode: root } as any)).toEqual(["main.bas", "src/lib.bas"]);
    expect(buildRootCandidatesOf(undefined)).toEqual([]);
  });
});
