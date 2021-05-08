import * as React from "react";
import { connect } from "react-redux";
import { getVersion } from "../../version";
import { AppState } from "../../shared/state/AppState";

interface Props {
}

/**
 * Represents the statusbar of the emulator
 */
class Statusbar extends React.Component<Props> {

  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div className="statusbar">
      <div key="1" className="section">
        <span className="label">
          Ide Statusbar
        </span>
      </div>
        <div key="placeholder" className="placeholder" />
        <div className="section">
          <span className="label">Klive {getVersion()}</span>
        </div>
      </div>
    );
  }
}

export default connect((state: AppState) => {
  return {
  };
}, null)(Statusbar);
