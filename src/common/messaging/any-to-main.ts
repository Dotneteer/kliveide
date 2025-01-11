import type { MessageBase } from "./messages-core";

export interface MainGeneralRequest extends MessageBase {
  type: "MainGeneralRequest";
  method: string;
  args: any;
}

export interface MainGeneralResponse extends MessageBase {
  type: "MainGeneralResponse";
  result: any;
}
