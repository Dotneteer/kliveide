import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { registerThemes } from "../common-ui/register-themes";
import IdeApp from "./IdeApp";
import { ideStore } from "./ideStore";
import { registerService, STORE_SERVICE } from "../../shared/services/service-registry";
import { getState, getStore } from "../../shared/services/store-helpers";

// --- Register the store service
registerService(STORE_SERVICE, ideStore);

// --- Prepare the themes used in this app
registerThemes(getState().isWindows ?? false);

ReactDOM.render(
  <Provider store={getStore().store}>
    <IdeApp />
  </Provider>,
  document.getElementById("app")
);
