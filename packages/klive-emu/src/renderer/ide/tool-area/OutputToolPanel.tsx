import * as React from "react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { ToolPanelBase, ToolPanelProps } from "../ToolPanelBase";
import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { ToolPanelDescriptorBase } from "./ToolAreaService";
import { getOutputPaneService, getToolAreaService } from "../../../abstractions/service-helpers";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common-ui/VirtualizedList";
import CommandIconButton from "../context-menu/CommandIconButton";
import { IOutputPane } from "../../../shared/services/IOutputPaneService";

const TITLE = "Output";

type State = {
  refreshCount: number;
  initPosition?: number;
  buffer: string[];
};

/**
 * The tool panel that represents the output
 */
export default class OutputToolPanel extends ToolPanelBase<
  ToolPanelProps<{}>,
  State
> {
  private _listApi: VirtualizedListApi;
  private _onPaneChanged: (pane: IOutputPane) => void;
  private _onContentsChanged: (pane: IOutputPane) => void;

  constructor(props: ToolPanelProps<{}>) {
    super(props);
    this._onPaneChanged = (pane: IOutputPane) => this.onOutputPaneChanged(pane);
    this._onContentsChanged = (pane: IOutputPane) =>
      this.onContentsChanged(pane);
    this.state = {
      refreshCount: 0,
      buffer: [],
    };
  }

  title = TITLE;

  componentDidMount() {
    const outputPaneService = getOutputPaneService();
    outputPaneService.activePaneChanged.on(this._onPaneChanged);
    outputPaneService.paneContentsChanged.on(this._onContentsChanged);
    const activePane = outputPaneService.getActivePane();
    if (activePane) {
      this.setState({
        buffer: activePane.buffer.getContents(),
      });
    }
  }

  componentWillUnmount() {
    const outputPaneService = getOutputPaneService();
    outputPaneService.activePaneChanged.off(this._onContentsChanged);
    outputPaneService.paneContentsChanged.off(this._onPaneChanged);
  }

  onOutputPaneChanged(pane: IOutputPane): void {
    this.setState({
      refreshCount: this.state.refreshCount + 1,
      buffer: pane.buffer.getContents(),
      initPosition: -1,
    });
  }

  onContentsChanged(pane: IOutputPane): void {
    if (pane === getOutputPaneService().getActivePane()) {
      this.setState({
        buffer: pane.buffer.getContents(),
        initPosition: -1,
      });
      this._listApi.scrollToEnd();
    }
  }

  renderContent() {
    return (
      <VirtualizedList
        key={this.state.refreshCount}
        itemHeight={18}
        numItems={this.state.buffer.length}
        renderItem={(index: number, style: CSSProperties) => {
          return (
            <div key={index} style={{ ...style }}>
              <div
                dangerouslySetInnerHTML={{ __html: this.state.buffer[index] }}
              />
            </div>
          );
        }}
        registerApi={(api) => (this._listApi = api)}
        obtainInitPos={() => this.state.initPosition}
        scrolled={(pos) => getToolAreaService().scrollActivePane(pos)}
      />
    );
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
    const outputPaneService = getOutputPaneService();
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
    const outputPaneService = getOutputPaneService();
    if (paneListComponent?.value) {
      const selectedPanel = outputPaneService.getPaneById(
        paneListComponent.value.toString()
      );
      outputPaneService.setActivePane(selectedPanel);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DropDownListComponent
        ref={(scope) => (paneListComponent = scope)}
        dataSource={panesData}
        fields={{ text: "title", value: "id" }}
        change={selectPane}
        width={170}
      />
      <div style={{ width: 6 }} />
      <CommandIconButton
        iconName="clear-all"
        title={"Clear Output"}
        clicked={() => getOutputPaneService().clearActivePane()}
      />
    </div>
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
