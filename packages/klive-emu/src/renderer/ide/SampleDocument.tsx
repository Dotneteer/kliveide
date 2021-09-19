import * as React from "react";
import { CSSProperties } from "styled-components";
import { DocumentPanelDescriptorBase, IDocumentPanel } from "./document-area/DocumentFactory";

/**
 * Component properties
 */
interface Props {
  color: string;
  descriptor: IDocumentPanel;
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
export default class SampleDocument extends React.Component<Props, State> {
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
      padding: 20,
      fontSize: 20,
      color: this.props.color,
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
export class SampleDocumentPanelDescriptor extends DocumentPanelDescriptorBase {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly color: string
  ) {
    super(id, title);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <SampleDocument color={this.color} descriptor={this} />;
  }
}
