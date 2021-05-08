import * as React from "react";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { AppState, EmuViewOptions } from "../../shared/state/AppState";
import { AppStateContext } from "../common/AppStateContext";
import { ideStore } from "./ideStore";
import { themeService } from "../themes/theme-service";
import { IThemeProperties } from "../themes/IThemeProperties";
import { connect } from "react-redux";
import IdeMainCanvas from "./IdeMainCanvas";
import "./ide-message-processor";
import { ideLoadUiAction } from "../../shared/state/ide-loaded-reducer";

interface Props {
  emuViewOptions: EmuViewOptions;
}

interface State {
  themeStyle: Record<string, string>;
  themeClass: string;
}

/**
 * Represents the emulator app's root component
 */
class IdeApp extends React.Component<Props, State> {
  // --- Keep track of theme changes
  private _themeAware: StateAwareObject<string>;

  // --- Use the application state as a context
  static contextType = AppStateContext;

  constructor(props: any) {
    super(props);
    this.state = {
      themeStyle: {},
      themeClass: "",
    };
  }

  componentDidMount() {
    // --- The emulator window is ready to set up the virtual machine
    ideStore.dispatch(ideLoadUiAction());

    // --- Handle theme updates
    this.updateThemeState();
    this._themeAware = new StateAwareObject(ideStore, "theme");
    this._themeAware.stateChanged.on((theme) => {
      themeService.setTheme(theme);
      this.updateThemeState();
    });
  }

  componentWillUnmount() {
    this._themeAware.dispose();
  }

  render() {
    return (
      <div style={this.state.themeStyle} className={this.state.themeClass}>
          <IdeMainCanvas/>
      </div>
    );
  }

  private updateThemeState(): void {
    const theme = themeService.getActiveTheme();
    if (!theme) {
      return;
    }
    let themeStyle: Record<string, string> = {};
    for (const key in theme.properties) {
      themeStyle[key] = theme.properties[key as keyof IThemeProperties];
    }
    this.setState({
      themeStyle,
      themeClass: `app-container ${theme.name}-theme`,
    });
  }
}

export default connect((state: AppState) => {
  return { emuViewOptions: state.emuViewOptions };
}, null)(IdeApp);
