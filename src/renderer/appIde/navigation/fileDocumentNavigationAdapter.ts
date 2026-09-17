import type { DocumentNavigationAdapter } from "@renderer/abstractions/DocumentNavigationAdapter";

/*
 * Navigation for a project file shown by a viewer with no finer position than "this file" — the NEX
 * file viewer, which the bank documents are popped out of. Being an entry is what lets Go Back
 * return to the viewer after opening a bank from it.
 *
 * Restore goes through `nav`, like the text editors, so a file that is no longer in the project
 * fails the restore and the history drops the entry.
 */
export const fileDocumentNavigationAdapter: DocumentNavigationAdapter = {
  capture() {
    return { kind: "document" };
  },

  isNear() {
    return true;
  },

  async restore(entry, hub, services) {
    const { projectService, ideCommandsService } = services;
    if (projectService.getActiveDocumentHubService() !== hub) {
      projectService.setActiveDocumentHubService(hub);
    }
    const result = await ideCommandsService.executeCommand(`nav "${entry.documentId}"`);
    return !!result?.success;
  },

  describe() {
    return "";
  }
};
