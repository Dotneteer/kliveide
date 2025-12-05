import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { IProjectService } from "@renderer/abstractions/IProjectService";

/**
 * Service to handle file reloading when files are changed externally
 */
export class FileReloadService {
  private _watchedFiles: Set<string> = new Set();
  private _ipc: any;

  constructor(
    private readonly projectService: IProjectService,
    private readonly onFileChanged: (filePath: string, document: ProjectDocumentState) => void
  ) {
    this._ipc = (window as any).electron?.ipcRenderer;
    this.setupIpcListeners();
  }

  /**
   * Sets up IPC listeners for file change notifications
   */
  private setupIpcListeners(): void {
    if (!this._ipc) return;

    this._ipc.on("file-changed-externally", (_event: any, { path: filePath }: { path: string }) => {
      this.handleFileChanged(filePath);
    });
  }

  /**
   * Handles a file change notification
   */
  private async handleFileChanged(filePath: string): Promise<void> {
    // Find the document in all document hubs
    const documentHubs = this.projectService.getDocumentHubServiceInstances();
    
    for (const hub of documentHubs) {
      const documents = hub.getOpenDocuments();
      const document = documents.find((doc) => doc.path === filePath || doc.id === filePath);
      
      if (document) {
        // Check if document has unsaved changes
        const hasUnsavedChanges = 
          document.editVersionCount !== undefined &&
          document.savedVersionCount !== undefined &&
          document.editVersionCount !== document.savedVersionCount;

        // Notify about the change
        this.onFileChanged(filePath, document);
        break;
      }
    }
  }

  /**
   * Start watching a file for external changes
   * @param filePath Path to the file to watch
   */
  watchFile(filePath: string): void {
    if (!this._ipc || !filePath || this._watchedFiles.has(filePath)) {
      return;
    }

    this._watchedFiles.add(filePath);
    this._ipc.send("watch-file", { filePath });
  }

  /**
   * Stop watching a file
   * @param filePath Path to the file to stop watching
   */
  unwatchFile(filePath: string): void {
    if (!this._ipc || !filePath || !this._watchedFiles.has(filePath)) {
      return;
    }

    this._watchedFiles.delete(filePath);
    this._ipc.send("unwatch-file", { filePath });
  }

  /**
   * Stop watching all files
   */
  unwatchAllFiles(): void {
    for (const filePath of this._watchedFiles) {
      this.unwatchFile(filePath);
    }
  }

  /**
   * Cleanup - remove IPC listeners
   */
  dispose(): void {
    if (this._ipc) {
      this._ipc.removeAllListeners("file-changed-externally");
    }
    this.unwatchAllFiles();
  }
}

