import { useTheme } from "@renderer/theming/ThemeProvider";
import { useRef } from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";
import styles from "./Tooltip.module.scss";

let lastId = 1;

function generateTooltipId() {
  return `__tooltip__id-${lastId++}`;
}

export function useTooltipId() {
  return useRef(generateTooltipId());
}

type Props = {
  anchorId: string;
  content?: string;
  place?: string;
  delayShow?: number;
  delayHide?: number;
  defaultIsOpen?: boolean;
  offset?: number;
};

export function Tooltip({
  anchorId,
  content,
  place = "bottom-start",
  delayShow,
  delayHide,
  defaultIsOpen = false,
  offset
}: Props) {
  const theme = useTheme();
  const border = theme.getThemeProperty("--border-tooltip");
  const modifiedContent = content?.replace(/\n/g, "<br />");
  return (
    <ReactTooltip
      className={styles.tooltipStyle}
      opacity={1.0}
      delayShow={delayShow}
      delayHide={delayHide}
      defaultIsOpen={defaultIsOpen}
      noArrow
      border={border}
      style={{ zIndex: 1 }}
      anchorSelect={`#${anchorId}`}
      place={place as any}
      offset={offset}
    >
      <div dangerouslySetInnerHTML={{ __html: modifiedContent }} />
    </ReactTooltip>
  );
}
