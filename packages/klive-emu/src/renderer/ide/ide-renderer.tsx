import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { ideStore } from "./ideStore";
import { registerThemes } from "../common-ui/register-themes";
import IdeApp from "./IdeApp";


// --- Prepare the themes used in this app
registerThemes(ideStore.getState().isWindows ?? false);

ReactDOM.render(
  <Provider store={ideStore.store}>
    <IdeApp />
  </Provider>,
  document.getElementById("app")
);
