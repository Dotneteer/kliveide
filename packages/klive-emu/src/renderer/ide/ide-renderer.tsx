import "_public/style.scss";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { ideStore } from "./ideStore";
import { setThemeAction } from "../../shared/state/theme-reducer";

ReactDOM.render(
  <Provider store={ideStore}>
    <div className="app">
      <h4 onClick={() => signInit()}>IDE window</h4>
    </div>
  </Provider>,
  document.getElementById("app")
);

function signInit(): void {
  ideStore.dispatch(setThemeAction("light"));
}
