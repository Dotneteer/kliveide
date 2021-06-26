import * as React from "react";
import { CSSProperties } from "styled-components";
import {
  IToolPanel,
  ToolPanelDescriptorBase,
} from "./tool-area/ToolAreaService";

/**
 * Component properties
 */
interface Props {
  color: string;
  descriptor: IToolPanel;
}

/**
 * Component state
 */
interface State {
  count: number;
}

/**
 * A sample document
 */
export default class SampleTool extends React.Component<Props, State> {
  static defaultProps = {
    color: "blue",
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      count: 0,
    };
  }

  componentDidMount(): void {
    const loadedState = this.props.descriptor.getPanelState();
    if (loadedState.count) {
      this.setState({ count: loadedState.count });
    }
  }

  render() {
    const placeholderStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
      width: "100%",
      height: "100%",
      border: `4px dotted ${this.props.color}`,
    };
    return (
      <div
        style={placeholderStyle}
        onClick={() => {
          const count = this.state.count + 1;
          this.setState({ count });
          this.props.descriptor.setPanelState({ count });
        }}
      >
        {this.state.count}
      </div>
    );
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class SampleToolPanelDescriptor extends ToolPanelDescriptorBase {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly color: string
  ) {
    super(title);
  }

  createHeaderElement(): React.ReactNode {
    return <div style={{ width: 80, height: "100%", background: this.color }} />;
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <SampleTool color={this.color} descriptor={this} />;
  }
}
