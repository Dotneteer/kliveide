import * as React from "react";
import { AppState, getInitialAppState } from "../../shared/state/AppState";

/**
 * The context that keeps the application state
 */
export const AppStateContext = React.createContext<AppState>(
  getInitialAppState()
);
