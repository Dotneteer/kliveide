import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { emuStore } from "./emuStore";
import { registerThemes } from "../common-ui/register-themes";
import EmuApp from "./EmuApp";

// --- Prepare the themes used in this app
registerThemes(emuStore.getState().isWindows ?? false);

// --- Render the main component of the emulator window
ReactDOM.render(
  <Provider store={emuStore.store}>
    <EmuApp></EmuApp>
  </Provider>,
  document.getElementById("app")
);
