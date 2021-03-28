/**
 * React renderer.
 */
// Import the styles here to process them with webpack
import "_public/style.css";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { ideStore } from "./ideStore";
import { ideLoadUi } from "../../shared/state/ide-loaded-reducer";

ReactDOM.render(
  <Provider store={ideStore}>
    <div className="app">
      <h4 onClick={() => signInit()}>IDE window</h4>
    </div>
  </Provider>,
  document.getElementById("app")
);

function signInit(): void {
  ideStore.dispatch(ideLoadUi())
}
