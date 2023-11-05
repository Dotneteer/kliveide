import { useTheme } from "@renderer/theming/ThemeProvider";
import { useState } from "react";

const NORMAL_WIDTH = 75;
const NORMAL_HEIGHT = 76;

/**
 * Component properties
 */
type Props = {
  zoom: number;
  mouseOnKey: () => void;
  mouseOutOfKey: () => void;
  mouseDown: () => void;
  mouseUp: () => void;
};

/**
 * Represents a key of the ZX Spectrum 48 keyboard
 */
export const Sp128EnterKeyTop = ({
  zoom,
  mouseOnKey,
  mouseOutOfKey,
  mouseDown,
  mouseUp
}: Props) => {
  // --- State bindings
  const [mouseOverKey, setMouseOverKey] = useState(false);

  // --- State dependent display properties
  const appliedZoom = zoom <= 0 ? 0.05 : zoom;
  const normalHeight = NORMAL_HEIGHT;
  const currentWidth = appliedZoom * NORMAL_WIDTH;
  const currentHeight = appliedZoom * NORMAL_HEIGHT;
  const cursor = mouseOverKey ? "pointer" : "default";

    // --- Invariant display properties
    const themeService = useTheme();
    const buttonBackColor = themeService.getThemeProperty(
      "--bgcolor-key128"
    );
    const buttonRaiseColor = themeService.getThemeProperty(
      "--bgcolor-key128-raise"
    );
  
  return (
    <svg
      width={currentWidth}
      height={currentHeight}
      viewBox={`0 0 ${NORMAL_WIDTH} ${normalHeight}`}
      style={{ marginRight: 2*zoom }}
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
        onMouseEnter={() => {
          setMouseOverKey(true);
          mouseOnKey?.();
        }}
        onMouseLeave={() => {
          setMouseOverKey(false);
          mouseOutOfKey?.();
        }}
        onMouseDown={() => mouseDown?.()}
        onMouseUp={() => mouseUp?.()}
      />
      <rect
        x={5.5}
        y={36}
        width={64}
        height={40}
        fill={buttonRaiseColor}
        cursor={cursor}
        onMouseEnter={() => {
          setMouseOverKey(true);
          mouseOnKey?.();
        }}
        onMouseLeave={() => {
          setMouseOverKey(false);
          mouseOutOfKey?.();
        }}
        onMouseDown={() => mouseDown?.()}
        onMouseUp={() => mouseUp?.()}
      />

      {/* Top rectangle */}
      <rect
        x='0'
        y={0}
        width='100%'
        height={24}
        fill={buttonBackColor}
        cursor={cursor}
      />
    </svg>
  );
};
