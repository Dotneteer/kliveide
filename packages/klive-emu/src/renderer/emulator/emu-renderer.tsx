import "_public/style.css";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { emuStore } from "./emuStore";
import { emuLoadUi } from "../../shared/state/emu-loaded-reducer";

// --- Render the main component of the emulator window
ReactDOM.render(
  <Provider store={emuStore}>
    <div className="app">
      <h4 onClick={() => signInit()}>Emulator window</h4>
    </div>
  </Provider>,
  document.getElementById("app")
);

function signInit(): void {
  emuStore.dispatch(emuLoadUi())
}
