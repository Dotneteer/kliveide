import { useTheme } from "@renderer/theming/ThemeProvider";
import { useState } from "react";

const NORMAL_WIDTH = 75;
const NORMAL_HEIGHT = 73;
const XTRA_WIDTH = 132;

/**
 * Component properties
 */
type Props = {
  zoom: number;
  hilited: boolean;
  mouseDown: () => void;
  mouseUp: () => void;
};

/**
 * Represents a key of the ZX Spectrum 48 keyboard
 */
export const Sp128EnterKeyBottom = ({
  zoom,
  hilited,
  mouseDown,
  mouseUp
}: Props) => {
  // --- State bindings
  const [mouseOverKey, setMouseOverKey] = useState(false);

  // --- Invariant display properties
  const themeService = useTheme();
  const highlightKeyColor = themeService.getThemeProperty(
    "--color-key128-highlight"
  );
  const buttonBackColor = themeService.getThemeProperty(
    "--bgcolor-key128"
  );
  const buttonRaiseColor = themeService.getThemeProperty(
    "--bgcolor-key128-raise"
  );
  const buttonTextColor = themeService.getThemeProperty(
    "--color-key128-main"
  );

  // --- State dependent display properties
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const normalHeight = NORMAL_HEIGHT;
  const currentWidth = appliedZoom * XTRA_WIDTH;
  const currentHeight = appliedZoom * NORMAL_HEIGHT;
  const mainColor = mouseOverKey || hilited ? highlightKeyColor : buttonTextColor;
  const mainStrokeColor = mouseOverKey || hilited ? highlightKeyColor : "transparent";
  const cursor = mouseOverKey ? "pointer" : "default";

  return (
    <svg
      width={currentWidth}
      height={currentHeight}
      viewBox={`0 0 ${XTRA_WIDTH} ${normalHeight}`}
      style={{ marginRight: 2*zoom, marginBottom: 2*zoom }}
      xmlns='http://www.w3.org/2000/svg'
    >
      {/* Button rectangle */}
      <rect
        x={0}
        y={0}
        width='100%'
        height='100%'
        fill={buttonBackColor}
        cursor={cursor}
      />

      {/* Button left ellipse */}
      <ellipse
        cx={NORMAL_WIDTH / 2}
        cy={NORMAL_WIDTH / 2}
        rx='32'
        ry='32'
        width='100%'
        height='100%'
        fill={buttonRaiseColor}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={() => mouseDown?.()}
        onMouseUp={() => mouseUp?.()}
      />

      {/* Button right ellipse */}
      <ellipse
        cx={NORMAL_WIDTH / 2 + (XTRA_WIDTH - NORMAL_WIDTH)}
        cy={NORMAL_WIDTH / 2}
        rx='32'
        ry='32'
        width='100%'
        height='100%'
        fill={buttonRaiseColor}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={() => mouseDown?.()}
        onMouseUp={() => mouseUp?.()}
      />

      {/* Button middle rect */}
      <rect
        x={NORMAL_WIDTH / 2}
        y={6}
        width={XTRA_WIDTH - NORMAL_WIDTH}
        height='63.5'
        fill={buttonRaiseColor}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={() => mouseDown?.()}
        onMouseUp={() => mouseUp?.()}
      />

      <rect
        x={62.5}
        y={0}
        width={64}
        height={36}
        fill={buttonRaiseColor}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={() => mouseDown?.()}
        onMouseUp={() => mouseUp?.()}
      />

      <text
        x='50%'
        textAnchor='middle'
        y={50}
        fontSize={10}
        fill={mainColor}
        stroke={mainStrokeColor}
        cursor={cursor}
        onMouseEnter={() => setMouseOverKey(true)}
        onMouseLeave={() => setMouseOverKey(false)}
        onMouseDown={() => mouseDown?.()}
        onMouseUp={() => mouseUp?.()}
      >
        ENTER
      </text>

      {/* Top rectangle */}
      <rect
        x='0'
        y={0}
        width={62.5}
        height={24}
        fill={buttonBackColor}
        cursor={cursor}
      />
    </svg>
  );
};
