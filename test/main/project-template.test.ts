import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  copyTemplate,
  findTemplateConflicts,
  listTemplateFiles,
  readTemplateMerge
} from "@main/project-template";

/**
 * The template copy rules shared by New Project and making a plain folder a project
 * (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.4).
 */
describe("project templates", () => {
  let template: string;
  let target: string;

  const write = (root: string, relPath: string, contents: string) => {
    const file = path.join(root, ...relPath.split("/"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };
  const read = (root: string, relPath: string) =>
    fs.readFileSync(path.join(root, ...relPath.split("/")), "utf8");

  beforeEach(() => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "klive-template-"));
    template = path.join(base, "template");
    target = path.join(base, "target");
    fs.mkdirSync(target);
    write(template, "build.ksx", "template build");
    write(template, "code/program.zxbas", "template program");
    write(template, "code/lib/util.bas", "template util");
    write(template, "__$klive.project", JSON.stringify({ builder: { roots: ["code/program.zxbas"] } }));
    write(template, "code/__$notes.txt", "metadata in a subfolder");
  });

  it("lists the files with forward slashes, sorted, without metadata at any level", () => {
    expect(listTemplateFiles(template)).toEqual(["build.ksx", "code/lib/util.bas", "code/program.zxbas"]);
  });

  it("fails for a template folder that does not exist", () => {
    expect(() => listTemplateFiles(path.join(template, "missing"))).toThrow();
  });

  it("reports no conflicts in an empty folder", () => {
    expect(findTemplateConflicts(template, target)).toEqual([]);
  });

  it("reports existing files as replaceable and taken places as not", () => {
    write(target, "build.ksx", "mine");
    fs.mkdirSync(path.join(target, "code", "program.zxbas"), { recursive: true });
    write(target, "code/lib", "a file where the template needs a folder");

    expect(findTemplateConflicts(template, target)).toEqual([
      { path: "build.ksx", canOverwrite: true },
      { path: "code/lib/util.bas", canOverwrite: false },
      { path: "code/program.zxbas", canOverwrite: false }
    ]);
    // --- Nothing was written by looking
    expect(read(target, "build.ksx")).toBe("mine");
  });

  it("copies into an empty folder, creating subfolders, skipping metadata", () => {
    const result = copyTemplate(template, target);

    expect(result).toEqual({
      written: ["build.ksx", "code/lib/util.bas", "code/program.zxbas"],
      skipped: []
    });
    expect(read(target, "code/lib/util.bas")).toBe("template util");
    expect(fs.existsSync(path.join(target, "__$klive.project"))).toBe(false);
    expect(fs.existsSync(path.join(target, "code", "__$notes.txt"))).toBe(false);
  });

  it("keeps existing files unless they are named", () => {
    write(target, "build.ksx", "my build");
    write(target, "code/program.zxbas", "my program");

    const result = copyTemplate(template, target, ["code/program.zxbas"]);

    expect(result.written).toEqual(["code/lib/util.bas", "code/program.zxbas"]);
    expect(result.skipped).toEqual(["build.ksx"]);
    expect(read(target, "build.ksx")).toBe("my build");
    expect(read(target, "code/program.zxbas")).toBe("template program");
  });

  it("replaces every existing file with 'all', but never a taken place", () => {
    write(target, "build.ksx", "my build");
    fs.mkdirSync(path.join(target, "code", "program.zxbas"), { recursive: true });

    const result = copyTemplate(template, target, "all");

    expect(result.written).toEqual(["build.ksx", "code/lib/util.bas"]);
    expect(result.skipped).toEqual(["code/program.zxbas"]);
    expect(read(target, "build.ksx")).toBe("template build");
    expect(fs.statSync(path.join(target, "code", "program.zxbas")).isDirectory()).toBe(true);
  });

  it("reads the merge file, and treats a missing or malformed one as empty", () => {
    expect(readTemplateMerge(template)).toEqual({ builder: { roots: ["code/program.zxbas"] } });

    fs.writeFileSync(path.join(template, "__$klive.project"), "not json");
    expect(readTemplateMerge(template)).toEqual({});

    fs.writeFileSync(path.join(template, "__$klive.project"), "[1, 2]");
    expect(readTemplateMerge(template)).toEqual({});

    fs.rmSync(path.join(template, "__$klive.project"));
    expect(readTemplateMerge(template)).toEqual({});
  });
});
