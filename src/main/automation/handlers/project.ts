import type { ProjectTreeNode } from "@main/ksx-runner/ProjectStructure";
import type { BuildResult } from "@common/automation/protocol";
import { automationError, invalidParams } from "../errors";
import type { MethodContext, MethodTable } from "../method-types";
import {
  optionalBoolean,
  optionalInt,
  optionalString,
  requireSingleLine
} from "../method-types";
import { commandRunResult, diagnosticsOf, quoteCommandArg, runIdeCommand } from "./commands";

/*
 * `project.*` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2, D10). The IDE renderer orchestrates
 * compilation, so building, running and exporting go through the same commands the Machine menu
 * and the toolbar use (`compile`, `run`, `debug`, `inject`, `expc`), and their structured results
 * come from each command's `value` rather than from its text. A failed build is a result with
 * `success: false` and its `errors`, not a protocol error: the build ran and reported.
 */

function requireProject(ctx: MethodContext, klive = true): void {
  const project = ctx.host.getState()?.project;
  if (!project?.folderPath) throw automationError("no-project", "No project is open.");
  if (klive && !project.isKliveProject) {
    throw automationError("no-project", "The open folder is not a Klive project.");
  }
}

/** The project's files, as project-relative paths */
function filesOf(nodes: ProjectTreeNode[] | undefined, into: string[] = []): string[] {
  for (const node of nodes ?? []) {
    if (node.isFolder) filesOf(node.children, into);
    else into.push(node.projectPath);
  }
  return into;
}

/** Runs a build-type command and reports it as a build result */
async function buildCommand(ctx: MethodContext, command: string): Promise<BuildResult> {
  requireProject(ctx);
  const run = commandRunResult(await runIdeCommand(ctx, command));
  const errors = diagnosticsOf(run.value);
  const { value: _value, ...rest } = run;
  ctx.publish("project.built", {
    success: run.success,
    errorCount: errors.filter((e) => !e.warning).length
  });
  return { ...rest, errors };
}

/** `expc`'s formats */
const EXPORT_FORMATS = ["tap", "tzx", "hex", "nex"];

export const projectMethods: MethodTable = {
  "project.info": {
    level: "read",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => {
      requireProject(ctx, false);
      const project = ctx.host.getState().project!;
      const structure = await ctx.host.ide.getProjectStructure();
      return {
        folder: project.folderPath,
        isKliveProject: !!project.isKliveProject,
        buildRoot: project.buildRoots?.[0] ?? null,
        hasBuildFile: !!project.hasBuildFile,
        files: filesOf(structure?.children)
      };
    }
  },
  "project.build": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => buildCommand(ctx, "compile")
  },
  "project.run": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => buildCommand(ctx, "run")
  },
  "project.debug": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => buildCommand(ctx, "debug")
  },
  "project.inject": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => buildCommand(ctx, "inject")
  },
  "project.export": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      requireProject(ctx);
      const file = requireSingleLine(params, "file");
      const parts = ["expc", quoteCommandArg(file)];
      const format = optionalString(params, "format")?.toLowerCase();
      if (format !== undefined) {
        if (!EXPORT_FORMATS.includes(format)) {
          throw invalidParams(`'format' must be one of: ${EXPORT_FORMATS.join(", ")}.`);
        }
        parts.push("-f", format);
      }
      const name = optionalString(params, "name");
      if (name !== undefined) {
        if (/[\r\n]/.test(name)) throw invalidParams("'name' must be a single line.");
        parts.push("-n", quoteCommandArg(name));
      }
      if (optionalBoolean(params, "autoStart")) parts.push("-as");
      if (optionalBoolean(params, "addPause")) parts.push("-p");
      if (optionalBoolean(params, "addClear")) parts.push("-c");
      if (optionalBoolean(params, "singleBlock")) parts.push("-sb");
      const border = optionalInt(params, "border", 0, 7);
      if (border !== undefined) parts.push("-b", String(border));
      const address = optionalInt(params, "address", 0x4000, 0xffff);
      if (address !== undefined) parts.push("-addr", String(address));
      const screenFile = optionalString(params, "screenFile");
      if (screenFile !== undefined) {
        if (/[\r\n]/.test(screenFile)) throw invalidParams("'screenFile' must be a single line.");
        parts.push("-scr", quoteCommandArg(screenFile));
      }
      return await buildCommand(ctx, parts.join(" "));
    }
  },
  "project.open": {
    level: "full",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      const folder = requireSingleLine(params, "folder");
      const problem = await ctx.host.openFolder(folder);
      if (problem) throw automationError("command-failed", problem);
      const project = ctx.host.getState()?.project;
      return { folder: project?.folderPath ?? folder, isKliveProject: !!project?.isKliveProject };
    }
  }
};
