import { IKliveCommand, KliveCommandContext } from "../../../extensibility/abstractions/command-def";

export const startVmCommand: IKliveCommand = {
  get commandId(): string {
    return "klive.startVm";
  },

  async queryState(context: KliveCommandContext): Promise<void> {
      switch (context.process) {
      }
  },
};
