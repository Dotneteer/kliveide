import { InjectedSegment } from "./InjectedSegment";

export interface CodeToInject {
  model: string;
  entryAddress?: number;
  subroutine?: boolean;
  segments: InjectedSegment[];
  options: { [key: string]: boolean };
}
