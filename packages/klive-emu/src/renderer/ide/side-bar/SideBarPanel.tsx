import * as React from "react";
import { useState } from "react";
import SideBarHeader from "./SideBarHeader";
import { ISideBarPanel } from "./SideBarService";

/**
 * Component properties
 */
interface Props {
  descriptor: ISideBarPanel;
  index: number;
  sizeable: boolean;
  panelPercentage: number;
  visibilityChanged: () => void;
  resized: (index: number, delta: number) => void;
}

/**
 * Represents a panel of the side bar
 * A side bar panel is composed from a header and a content panel. The header
 * allows expanding or collapsing the panel, and provides a resizing grip.
 */
export default function SideBarPanel(props: Props) {
  const [expanded, setExpanded] = useState(props.descriptor.expanded);

  return (
    <div className={expanded ? "expanded" : "collapsed"} style={{height: expanded ? `${props.panelPercentage}%` : null}}>
      <SideBarHeader
        title={props.descriptor.title}
        expanded={expanded}
        sizeable={props.sizeable}
        index={props.index}
        panelPercentage={props.panelPercentage}
        clicked={() => {
          const newExpanded = !expanded;
          setExpanded(newExpanded);
          props.descriptor.expanded = newExpanded;
          props.visibilityChanged();
        }}
        resized={(delta: number) => props.resized(props.index, delta)}
      />
      <div
        className="host-panel"
        style={{
          display: expanded ? "flex" : "none",
        }}
      >
        {props.descriptor.createContentElement()}
      </div>
    </div>
  );
}
