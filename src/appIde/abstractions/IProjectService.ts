import { ILiteEvent } from "@/emu/utils/lite-event";

export type IProjectService = {
  readonly projectOpened: ILiteEvent<void>;
  readonly projectClosed: ILiteEvent<void>;
};
