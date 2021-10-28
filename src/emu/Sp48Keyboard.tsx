import * as React from "react";
import styles from "styled-components";

import { getVmEngineService } from "@modules-core/vm-engine-service";
import { ZxSpectrumCoreBase } from "@modules/vm-zx-spectrum/ZxSpectrumCoreBase";
import Key from "./Sp48Key";
import { Sp48ButtonClickArgs } from "./ui-core-types";

const DEFAULT_WIDTH = 10 * 104 + 130 + 48;
const DEFAULT_HEIGHT = 4 * (128 + 16) + 48;

interface Props {
  width: number;
  height: number;
}

/**
 * Represents the statusbar of the emulator
 */
export default function Sp48Keyboard(props: Props) {
  const zoom = calculateZoom(props.width, props.height);
    const row1Shift = 80 * zoom;
    const row2Shift = 110 * zoom;
    return (
      <Root>
        <KeyRow>
          <Key
            zoom={zoom}
            code={15}
            keyAction={handleClick}
            topNum="BLUE"
            topNumColor="#0030ff"
            main="1"
            symbol="!"
            above="EDIT"
            below="DEF FN"
            glyph={1}
          />
          <Key
            zoom={zoom}
            code={16}
            keyAction={handleClick}
            topNum="RED"
            topNumColor="#ff0000"
            main="2"
            symbol="@"
            above="CAPS LOCK"
            below="FN"
            glyph={2}
          />
          <Key
            zoom={zoom}
            code={17}
            keyAction={handleClick}
            topNum="MAGENTA"
            topNumColor="#e000e0"
            main="3"
            symbol="#"
            above="TRUE VID"
            below="LINE"
            glyph={3}
          />
          <Key
            zoom={zoom}
            code={18}
            keyAction={handleClick}
            topNum="GREEN"
            topNumColor="#00c000"
            main="4"
            symbol="$"
            above="INV.VIDEO"
            below="OPEN"
            glyph={4}
          />
          <Key
            zoom={zoom}
            code={19}
            keyAction={handleClick}
            topNum="CYAN"
            topNumColor="#00c0c0"
            main="5"
            symbol="%"
            above={"\u140a"}
            below="CLOSE"
            glyph={5}
          />
          <Key
            zoom={zoom}
            code={24}
            keyAction={handleClick}
            topNum="YELLOW"
            topNumColor="#fff000"
            main="6"
            symbol={"&"}
            above={"\u1401"}
            below="MOVE"
            glyph={6}
          />
          <Key
            zoom={zoom}
            code={23}
            keyAction={handleClick}
            topNum="WHITE"
            topNumColor="#ffffff"
            main="7"
            symbol={"'"}
            above={"\u1403"}
            below="ERASE"
            glyph={7}
          />
          <Key
            zoom={zoom}
            code={22}
            keyAction={handleClick}
            topNum="UNBRIGHT"
            topNumColor="#a0a0a0"
            main="8"
            symbol={"("}
            above={"\u1405"}
            below="POINT"
            glyph={16}
          />
          <Key
            zoom={zoom}
            code={21}
            keyAction={handleClick}
            topNum="BRIGHT"
            main="9"
            symbol={")"}
            above="GRAPHICS"
            below="CAT"
          />
          <Key
            zoom={zoom}
            code={20}
            keyAction={handleClick}
            topNum="BLACK"
            topNumColor="#606060"
            main="0"
            symbol={"\uff3f"}
            above="DELETE"
            below="FORMAT"
          />
        </KeyRow>
        <KeyRow style={{ marginLeft: row1Shift }}>
          <Key
            zoom={zoom}
            code={10}
            keyAction={handleClick}
            main="Q"
            keyword="PLOT"
            symbol="<="
            above="SIN"
            below="ASN"
          />
          <Key
            zoom={zoom}
            code={11}
            keyAction={handleClick}
            main="W"
            keyword="DRAW"
            symbol="<>"
            above="COS"
            below="ACS"
          />
          <Key
            zoom={zoom}
            code={12}
            keyAction={handleClick}
            main="E"
            keyword="REM"
            symbol=">="
            above="TAN"
            below="ATB"
          />
          <Key
            zoom={zoom}
            code={13}
            keyAction={handleClick}
            main="R"
            keyword="RUN"
            symbol="<"
            above="INT"
            below="VERIFY"
          />
          <Key
            zoom={zoom}
            code={14}
            keyAction={handleClick}
            main="T"
            keyword="RAND"
            symbol=">"
            above="RND"
            below="MERGE"
          />
          <Key
            zoom={zoom}
            code={29}
            keyAction={handleClick}
            main="Y"
            keyword="RETURN"
            symbolWord="AND"
            above="STR$"
            below="["
          />
          <Key
            zoom={zoom}
            code={28}
            keyAction={handleClick}
            main="U"
            keyword="IF"
            symbolWord="OR"
            above="CHR$"
            below="]"
          />
          <Key
            zoom={zoom}
            code={27}
            keyAction={handleClick}
            main="I"
            keyword="INPUT"
            symbolWord="AT"
            above="CODE"
            below="IN"
          />
          <Key
            zoom={zoom}
            code={26}
            keyAction={handleClick}
            main="O"
            keyword="POKE"
            symbol=";"
            above="PEEK"
            below="OUT"
          />
          <Key
            zoom={zoom}
            code={25}
            keyAction={handleClick}
            main="P"
            keyword="PRINT"
            symbol={'"'}
            above="TAB"
            below="(C)"
          />
        </KeyRow>
        <KeyRow style={{ marginLeft: row2Shift }}>
          <Key
            zoom={zoom}
            code={5}
            keyAction={handleClick}
            main="A"
            keyword="NEW"
            symbolWord="STOP"
            above="READ"
            below="~"
          />
          <Key
            zoom={zoom}
            code={6}
            keyAction={handleClick}
            main="S"
            keyword="SAVE"
            symbolWord="NOT"
            above="RESTORE"
            below="|"
          />
          <Key
            zoom={zoom}
            code={7}
            keyAction={handleClick}
            main="D"
            keyword="DIM"
            symbolWord="STEP"
            above="DATA"
            below="\"
          />
          <Key
            zoom={zoom}
            code={8}
            keyAction={handleClick}
            main="F"
            keyword="FOR"
            symbolWord="TO"
            above="SGN"
            below={"{"}
          />
          <Key
            zoom={zoom}
            code={9}
            keyAction={handleClick}
            main="G"
            keyword="GOTO"
            symbolWord="THEN"
            above="ABS"
            below="}"
          />
          <Key
            zoom={zoom}
            code={34}
            keyAction={handleClick}
            main="H"
            keyword="GOSUB"
            symbol={"\u2191"}
            above="SQR"
            below="CIRCLE"
          />
          <Key
            zoom={zoom}
            code={33}
            keyAction={handleClick}
            main="J"
            keyword="LOAD"
            symbol={"\u2212"}
            above="VAL"
            below="VAL$"
          />
          <Key
            zoom={zoom}
            code={32}
            keyAction={handleClick}
            main="K"
            keyword="LIST"
            symbol="+"
            above="LEN"
            below="SCREEN$"
          />
          <Key
            zoom={zoom}
            code={31}
            keyAction={handleClick}
            main="L"
            keyword="LET"
            symbol="="
            above="USR"
            below="ATTR"
          />
          <Key
            zoom={zoom}
            code={30}
            keyAction={handleClick}
            center="ENTER"
          />
        </KeyRow>
        <KeyRow>
          <Key
            zoom={zoom}
            code={0}
            keyAction={handleClick}
            xwidth={130}
            top="CAPS"
            bottom="SHIFT"
          />
          <Key
            zoom={zoom}
            code={1}
            keyAction={handleClick}
            main="Z"
            keyword="COPY"
            symbol=":"
            above="LN"
            below="BEEP"
          />
          <Key
            zoom={zoom}
            code={2}
            keyAction={handleClick}
            main="X"
            keyword="CLEAR"
            symbol={"\u00a3"}
            above="EXP"
            below="INK"
          />
          <Key
            zoom={zoom}
            code={3}
            keyAction={handleClick}
            main="C"
            keyword="CONT"
            symbol="?"
            above="LPRINT"
            below="PAPER"
          />
          <Key
            zoom={zoom}
            code={4}
            keyAction={handleClick}
            main="V"
            keyword="CLS"
            symbol="/"
            above="LLIST"
            below="FLASH"
          />
          <Key
            zoom={zoom}
            code={39}
            keyAction={handleClick}
            main="B"
            keyword="BORDER"
            symbol="*"
            above="BIN"
            below="BRIGHT"
          />
          <Key
            zoom={zoom}
            code={38}
            keyAction={handleClick}
            main="N"
            keyword="NEXT"
            symbol=","
            above="INKEY$"
            below="OVER"
          />
          <Key
            zoom={zoom}
            code={37}
            keyAction={handleClick}
            main="M"
            keyword="PAUSE"
            symbol="."
            above="INVERSE"
            below="PI"
          />
          <Key
            zoom={zoom}
            code={36}
            keyAction={handleClick}
            top="SYMBOL"
            bottom="SHIFT"
            useSymColor={true}
          />
          <Key
            zoom={zoom}
            code={35}
            keyAction={handleClick}
            xwidth={180}
            top="BREAK"
            center="SPACE"
          />
        </KeyRow>
      </Root>
    );

  function handleClick(e: Sp48ButtonClickArgs): void {
    const vmEngineService = getVmEngineService();
    if (!vmEngineService.hasEngine) {
      // --- No engine
      return;
    }
    const engine = vmEngineService.getEngine() as ZxSpectrumCoreBase;
    const frameCount = engine.getMachineState().frameCount;
    if (vmEngineService.getKeyQueueLength() > 0) {
      // --- Emulated keys are being played back
      return;
    }

    switch (e.keyCategory) {
      case "main":
        setKeyStatus(e.down, e.code, e.button === 0 ? undefined : 0 /* CShift */);
        break;
      case "symbol":
        setKeyStatus(e.down, e.code, 36 /* SShift */);
        break;
      case "above":
        if (e.down) {
          vmEngineService.queueKeyStroke(
            frameCount,
            2,
            0 /* CShift */,
            36 /* SShift */
          );
          vmEngineService.queueKeyStroke(
            frameCount + 3,
            2,
            e.code,
            e.button === 0 ? undefined : 0 /* CShift */
          );
        }
        break;
      case "below":
        if (e.down) {
          vmEngineService.queueKeyStroke(
            frameCount,
            2,
            0 /* CShift */,
            36 /* SShift */
          );
          vmEngineService.queueKeyStroke(
            frameCount + 3,
            2,
            e.code,
            36 /* SShift */
          );
        }
        break;
      case "topNum":
        setKeyStatus(e.down, e.code, 0);
        break;
      case "glyph":
        if ((engine.getCursorMode() & 0x02) !== 0) return;
        if (e.down) {
          vmEngineService.queueKeyStroke(
            frameCount,
            2,
            21 /* N9 */,
            0 /* CShift */
          );
          vmEngineService.queueKeyStroke(
            frameCount + 3,
            2,
            e.code,
            e.button === 0 ? undefined : 0 /* CShift */
          );
          vmEngineService.queueKeyStroke(
            frameCount + 6,
            2,
            21 /* N9 */,
            0 /* CShift */
          );
        }
        break;
    }

    /**
     * Sets the status of the specified keys
     * @param down Is pressed down?
     * @param primary Primary key
     * @param secondary Optional secondary key
     */
    function setKeyStatus(
      down: boolean,
      primary: number,
      secondary?: number
    ): void {
      engine.setKeyStatus(primary, down);
      if (secondary !== undefined) {
        engine.setKeyStatus(secondary, down);
      }
    }
  };

  function calculateZoom(width: number, height: number): number {
    if (!width || !height) return 0.05;
    let widthRatio = (width - 24) / DEFAULT_WIDTH;
    let heightRatio = (height - 32) / DEFAULT_HEIGHT;
    return Math.min(widthRatio, heightRatio);
  }
}

// --- Helper component tags
const Root = styles.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  flex-grow: 0;
  height: 100%;
  background-color: transparent;
  box-sizing: border-box;
  align-content: start;
  justify-items: start;
  justify-content: center;
  overflow: hidden;
`;

const KeyRow = styles.div`
  padding: 0px 0px;
  margin: 0;
  display: flex;
  flex-grow: 0;
  flex-shrink: 0;
`;

