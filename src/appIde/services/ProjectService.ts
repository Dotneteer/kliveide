import { ILiteEvent, LiteEvent } from "@/emu/utils/lite-event";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { IProjectService } from "../abstractions";

class ProjectService implements IProjectService {
  private _oldState: AppState;
  private _projectOpened = new LiteEvent<void>();
  private _projectClosed = new LiteEvent<void>();

  constructor (store: Store<AppState>) {
    store.subscribe(() => {
      const newState = store.getState();  
      const newFolderPath = newState?.project?.folderPath;
      const oldFolderPath = this._oldState?.project?.folderPath;
      this._oldState = newState;
      if (oldFolderPath !== newFolderPath) {
        if (newFolderPath) {
          this._projectOpened.fire();
        } else {
          this._projectClosed.fire();
        }
      }
    });
  }

  get projectOpened (): ILiteEvent<void> {
    return this._projectOpened;
  }

  get projectClosed (): ILiteEvent<void> {
    return this._projectClosed;
  }
}

export const createProjectService = (store: Store<AppState>) =>
  new ProjectService(store);
