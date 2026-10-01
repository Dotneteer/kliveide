import type { DocumentNavigationAdapter } from "@renderer/abstractions/DocumentNavigationAdapter";

/*
 * Navigation for a project file shown by a viewer with no finer position than "this file" — the NEX
 * file viewer and the `.z88` snapshot viewer, which bank documents are popped out of. Being an entry
 * is what lets Go Back return to the viewer after opening a bank from it. A viewer with pop-outs and
 * no adapter records only the destination, so Go Back has nowhere to go.
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
