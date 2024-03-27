import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";

export type ContextMenuInfo = {
  separator?: boolean;
  dangerous?: boolean;
  text?: string;
  disabled?: (store: Store<AppState>, item: any) => boolean;
  clicked?: (arg: any) => Promise<void>;
};
