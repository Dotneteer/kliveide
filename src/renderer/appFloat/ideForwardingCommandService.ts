import type { IIdeCommandService } from "@renderer/abstractions/IIdeCommandService";
import type { MainApi } from "@common/messaging/MainApi";

/**
 * A command service that runs every command in the IDE window. A document's command bar acts on the
 * project and the machine (build, inject, run, load a tape or a NEX): its output and the documents it
 * opens belong in the IDE, not in the floating window, which has no output panes.
 */
export function createIdeForwardingCommandService(
  local: IIdeCommandService,
  mainApi: Pick<MainApi, "executeIdeCommand">
): IIdeCommandService {
  return new Proxy(local, {
    get(target, prop, receiver) {
      if (prop === "executeCommand") {
        return (commandText: string) => mainApi.executeIdeCommand(commandText);
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}
