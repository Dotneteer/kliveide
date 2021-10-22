import * as React from "react";
import { CSSProperties, useEffect, useRef, useState } from "react";

import {
  getOutputPaneService,
  getState,
  getToolAreaService,
} from "@core/service-registry";

import { ToolPanelBase, ToolPanelProps } from "../ToolPanelBase";
import {
  ChangeEventArgs,
  DropDownListComponent,
} from "@syncfusion/ej2-react-dropdowns";
import { ToolPanelDescriptorBase } from "./ToolAreaService";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../../emu-ide/components/VirtualizedList";
import CommandIconButton from "../context-menu/CommandIconButton";
import { IOutputPane } from "@abstractions/output-pane-service";
import { OUTPUT_TOOL_ID } from "@abstractions/tool-area-service";

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
        buffer: activePane.buffer.getContents().map((lc) => lc.text),
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
      buffer: pane.buffer.getContents().map(lc => lc.text),
      initPosition: -1,
    });
  }

  onContentsChanged(pane: IOutputPane): void {
    if (pane === getOutputPaneService().getActivePane()) {
      this.setState({
        buffer: pane.buffer.getContents().map(lc => lc.text),
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
            <div key={index} style={{ ...style, fontSize: "0.95em" }}>
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
  const mounted = useRef(false);
  const [panesData, setPanesData] = useState<PaneData[]>();
  const [value, setValue] = useState<string>();

  const paneChanged = () => {
    const paneId = getOutputPaneService().getActivePane().id.toString();
    setValue(paneId);
  };

  useEffect(() => {
    const outputPaneService = getOutputPaneService();
    if (!mounted.current) {
      // --- Mount
      const panes = outputPaneService
        .getOutputPanes()
        .map((p) => ({ id: p.id, title: p.title }));
      setPanesData(panes);
      setValue(value ?? panes[0].id.toString());
      outputPaneService.activePaneChanged.on(paneChanged);
      mounted.current = true;
    }

    return () => {
      outputPaneService.activePaneChanged.off(paneChanged);
      mounted.current = false;
    };
  }, [value]);

  const selectPane = (e: ChangeEventArgs) => {
    const outputPaneService = getOutputPaneService();
    const selectedPanel = outputPaneService.getPaneById(
      (e.itemData as PaneData).id
    );
    if (selectedPanel) {
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
        dataSource={panesData}
        fields={{ text: "title", value: "id" }}
        change={(e) => selectPane(e)}
        value={value}
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
    super(OUTPUT_TOOL_ID, TITLE);
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
