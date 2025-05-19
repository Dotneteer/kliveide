import { ILiteEvent } from "@abstractions/ILiteEvent";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { startBackgroundCompileAction } from "@common/state/actions";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { LiteEvent } from "@emu/utils/lite-event";
import { BackgroundCompiler } from "@main/compiler-integration/backgroundRun";
import { CompilationCompleted, ILanguageService } from "@renderer/abstractions/ILanguageService";

class LanguageService implements ILanguageService {
  private readonly _compilationCompleted: ILiteEvent<CompilationCompleted> = new LiteEvent<CompilationCompleted>();
  private _backgroundCompiler: BackgroundCompiler | null = null;
  

  constructor(
    private readonly store: Store<AppState>,
    private readonly messenger: MessengerBase
  ) {
    // Initialize any necessary properties or state here
  }

  isBackgroundCompilationInProgress(): boolean {
    return this.store.getState()?.compilation?.backgroundInProgress ?? false;
  }

  startBackgroundCompilation(): void {
    if (this.isBackgroundCompilationInProgress()) {
      return;
    }
    
    this.store.dispatch(startBackgroundCompileAction());
    // TODO: Add logic to start the background compilation process
  }

  get compilationCompleted(): ILiteEvent<CompilationCompleted> {
    return this._compilationCompleted;
  }
}
