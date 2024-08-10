import type { AppState } from "@state/AppState";
import type { Store } from "@state/redux-light";

export type ContextMenuInfo = {
  separator?: boolean;
  dangerous?: boolean;
  text?: string;
  disabled?: (store: Store<AppState>, item: any) => boolean;
  clicked?: (arg: any) => Promise<void>;
};
