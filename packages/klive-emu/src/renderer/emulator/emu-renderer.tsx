import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { registerThemes } from "../common-ui/register-themes";
import EmuApp from "./EmuApp";
import { getState, getStore } from "./emuStore";

// --- Prepare the themes used in this app
registerThemes(getState().isWindows ?? false);

// --- Render the main component of the emulator window
ReactDOM.render(
  <Provider store={getStore().store}>
    <EmuApp></EmuApp>
  </Provider>,
  document.getElementById("app")
);
