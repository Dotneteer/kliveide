(window as any)["global"] = window;

import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { ideStore } from "./ideStore";
import { registerThemes } from "../common/register-themes";
import IdeApp from "./IdeApp";


// --- Prepare the themes used in this app
registerThemes(ideStore.getState().isWindows ?? false);

ReactDOM.render(
  <Provider store={ideStore}>
    <IdeApp />
  </Provider>,
  document.getElementById("app")
);
