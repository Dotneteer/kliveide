import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";

interface Props {
}

interface State {
}

/**
 * Represents the main canvas of the emulator
 */
class IdeMainCanvas extends React.Component<Props, State> {

  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div className="ide-main">
      </div>
    );
  }
}

export default connect((state: AppState) => {
  return {
  };
}, null)(IdeMainCanvas);
