import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import { useEffect, useState } from "react";
import { animationTick } from "../../../renderer/common/utils";
import SideBarPanelHeader from "./SideBarPanelHeader";
import { ISideBarPanel } from "./SideBarService";

/**
 * Component properties
 */
interface Props {
  descriptor: ISideBarPanel;
  index: number;
  sizeable: boolean;
  heightPercentage: number;
  visibilityChanged: (index: number) => void;
  startResize: (index: number) => void;
  resized: (delta: number) => void;
}

/**
 * Represents a panel of the side bar
 * A side bar panel is composed from a header and a content panel. The header
 * allows expanding or collapsing the panel, and provides a resizing grip.
 */
export default function SideBarPanel(props: Props) {
  const hostElement: React.RefObject<HTMLDivElement> = React.createRef();
  const [expanded, setExpanded] = useState(props.descriptor.expanded);

  useEffect(() => {
    // --- Get the initial width
    (async () => {
      await animationTick();
      if (hostElement.current) {
        props.descriptor.height = hostElement.current.offsetHeight;
      }
    })();
  });

  return (
    <div
      ref={hostElement}
      className={expanded ? "expanded" : "collapsed"}
      style={{
        height: expanded ? `${props.descriptor.heightPercentage}%` : null,
        transitionProperty: "height",
        transitionDuration: "0.25s",
      }}
    >
      <SideBarPanelHeader
        title={props.descriptor.title}
        expanded={expanded}
        sizeable={props.sizeable}
        index={props.index}
        clicked={async () => {
          const newExpanded = !expanded;
          setExpanded(newExpanded);
          props.descriptor.expanded = newExpanded;
          props.visibilityChanged(props.index);
        }}
        startResize={(index: number) => props.startResize(index)}
        resized={(delta: number) => props.resized(delta)}
      />
      <div
        className="host-panel"
        style={{
          display: expanded ? undefined : "none",
          color: "var(--information-color)",
          fontSize: "0.9em"
        }}
      >
        <div
          style={{
            left: 0,
            top: 0,
            height: 3,
            background: "transparent",
            boxShadow: "rgb(0,0,0) 0px 6px 6px -6px inset",
            zIndex: 0,
          }}
        />
        {props.descriptor.createContentElement()}
      </div>
      <ReactResizeDetector
        handleWidth
        handleHeight
        onResize={(_width, height) => {
          props.descriptor.height = height;
        }}
      />
    </div>
  );
}
