import * as React from "react";
import { useEffect, useState } from "react";
import { ToolPanelBase } from "../ToolPanelBase";
import { DropDownListComponent } from "@syncfusion/ej2-react-dropdowns";
import { ToolPanelDescriptorBase } from "./ToolAreaService";
import { outputPaneService } from "./OutputPaneService";

const TITLE = "Output";

/**
 * Z80 registers panel
 */
export default class OutputToolPanel extends ToolPanelBase {
  title = TITLE;
}

type PaneData = {
  id: string | number;
  title: string;
};

function OutputPanesPropertyBar() {
  let thisComponent: DropDownListComponent;
  const [panesData, setPanesData] = useState<PaneData[]>();

  useEffect(() => {
    // // --- Mount
    // setPanesData(
    //   outputPaneService
    //     .getOutputPanes()
    //     .map((p, index) => ({ id: index, title: p.title }))
    // );
    // thisComponent.value = outputPaneService.getActivePane()?.id;
  });

  return (
    <DropDownListComponent
      ref={(scope) => (thisComponent = scope)}
      dataSource={panesData}
      fields={{ text: "title", value: "id" }}
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
