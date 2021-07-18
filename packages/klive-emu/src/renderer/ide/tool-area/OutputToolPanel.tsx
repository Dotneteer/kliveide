import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ToolPanelBase, ToolPanelProps } from "../ToolPanelBase";
import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { ToolPanelDescriptorBase } from "./ToolAreaService";
import { IOutputPane, outputPaneService } from "./OutputPaneService";

const TITLE = "Output";

type State = {
  text: string;
};

/**
 * The tool panel that represents the output
 */
export default class OutputToolPanel extends ToolPanelBase<
  ToolPanelProps<{}>,
  State
> {
  private _onPaneChanged: (pane: IOutputPane) => void;

  constructor(props: ToolPanelProps<{}>) {
    super(props);
    this._onPaneChanged = (pane: IOutputPane) => this.onOutputPaneChanged(pane);
    this.state = {
      text: "No pane changed yet",
    };
  }

  title = TITLE;

  componentDidMount() {
    outputPaneService.activePaneChanged.on(this._onPaneChanged);
    const activePane = outputPaneService.getActivePane();
    if (activePane) {
      this.setState({text: `Current pane: ${activePane.id}`});
    }
  }

  componentWillUnmount() {
    outputPaneService.activePaneChanged.off(this._onPaneChanged);
  }

  onOutputPaneChanged(pane: IOutputPane): void {
    console.log(this);
    this.setState({ text: `New output panel: ${pane.id}` });
  }

  renderContent(): React.ReactNode {
    return <>{this.state.text}</>;
  }
}

type PaneData = {
  id: string | number;
  title: string;
};

function OutputPanesPropertyBar() {
  let paneListComponent: DropDownListComponent;
  const mounted = useRef(false);
  const [panesData, setPanesData] = useState<PaneData[]>();

  useEffect(() => {
    if (!mounted.current) {
      // --- Mount
      setPanesData(
        outputPaneService
          .getOutputPanes()
          .map((p) => ({ id: p.id, title: p.title }))
      );
      mounted.current = true;
    } else {
      paneListComponent.value = outputPaneService.getActivePane()?.id;
    }

    return () => {};
  });

  const selectPane = () => {
    const selectedPanel = outputPaneService.getPaneById(
      paneListComponent.value.toString()
    );
    outputPaneService.setActivePane(selectedPanel);
  };

  return (
    <DropDownListComponent
      ref={(scope) => (paneListComponent = scope)}
      dataSource={panesData}
      fields={{ text: "title", value: "id" }}
      change={selectPane}
      width={170}
    />
  );
}

/**
 * Descriptor for the sample side bar panel
 */
export class OutputToolPanelDescriptor extends ToolPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  createHeaderElement(): React.ReactNode {
    return (
      <div style={{ width: "auto", alignContent: "center" }}>
        <OutputPanesPropertyBar />
      </div>
    );
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <OutputToolPanel descriptor={this} />;
  }
}
