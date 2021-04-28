import * as React from "react";
import { ZxSpectrumCoreBase } from "../machines/spectrum/ZxSpectrumCoreBase";
import { vmEngineService } from "../machines/vm-engine-service";
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
export default class Sp48Keyboard extends React.Component<Props> {
  private _zoom = 0.05;

  constructor(props: Props) {
    super(props);
  }

  render() {
    this.calculateZoom(this.props.width, this.props.height);
    const row1Shift = 80 * this._zoom;
    const row2Shift = 110 * this._zoom;
    return (
      <div className="keyboard">
        <div className="key-row">
          <Key
            zoom={this._zoom}
            code={15}
            keyAction={this.handleClick}
            topNum="BLUE"
            topNumColor="#0030ff"
            main="1"
            symbol="!"
            above="EDIT"
            below="DEF FN"
            glyph={1}
          />
          <Key
            zoom={this._zoom}
            code={16}
            keyAction={this.handleClick}
            topNum="RED"
            topNumColor="#ff0000"
            main="2"
            symbol="@"
            above="CAPS LOCK"
            below="FN"
            glyph={2}
          />
          <Key
            zoom={this._zoom}
            code={17}
            keyAction={this.handleClick}
            topNum="MAGENTA"
            topNumColor="#e000e0"
            main="3"
            symbol="#"
            above="TRUE VID"
            below="LINE"
            glyph={3}
          />
          <Key
            zoom={this._zoom}
            code={18}
            keyAction={this.handleClick}
            topNum="GREEN"
            topNumColor="#00c000"
            main="4"
            symbol="$"
            above="INV.VIDEO"
            below="OPEN"
            glyph={4}
          />
          <Key
            zoom={this._zoom}
            code={19}
            keyAction={this.handleClick}
            topNum="CYAN"
            topNumColor="#00c0c0"
            main="5"
            symbol="%"
            above={"\u140a"}
            below="CLOSE"
            glyph={5}
          />
          <Key
            zoom={this._zoom}
            code={24}
            keyAction={this.handleClick}
            topNum="YELLOW"
            topNumColor="#fff000"
            main="6"
            symbol={"&"}
            above={"\u1401"}
            below="MOVE"
            glyph={6}
          />
          <Key
            zoom={this._zoom}
            code={23}
            keyAction={this.handleClick}
            topNum="WHITE"
            topNumColor="#ffffff"
            main="7"
            symbol={"'"}
            above={"\u1403"}
            below="ERASE"
            glyph={7}
          />
          <Key
            zoom={this._zoom}
            code={22}
            keyAction={this.handleClick}
            topNum="UNBRIGHT"
            topNumColor="#a0a0a0"
            main="8"
            symbol={"("}
            above={"\u1405"}
            below="POINT"
            glyph={16}
          />
          <Key
            zoom={this._zoom}
            code={21}
            keyAction={this.handleClick}
            topNum="BRIGHT"
            main="9"
            symbol={")"}
            above="GRAPHICS"
            below="CAT"
          />
          <Key
            zoom={this._zoom}
            code={20}
            keyAction={this.handleClick}
            topNum="BLACK"
            topNumColor="#606060"
            main="0"
            symbol={"\uff3f"}
            above="DELETE"
            below="FORMAT"
          />
        </div>
        <div className="key-row" style={{ marginLeft: row1Shift }}>
          <Key
            zoom={this._zoom}
            code={10}
            keyAction={this.handleClick}
            main="Q"
            keyword="PLOT"
            symbol="<="
            above="SIN"
            below="ASN"
          />
          <Key
            zoom={this._zoom}
            code={11}
            keyAction={this.handleClick}
            main="W"
            keyword="DRAW"
            symbol="<>"
            above="COS"
            below="ACS"
          />
          <Key
            zoom={this._zoom}
            code={12}
            keyAction={this.handleClick}
            main="E"
            keyword="REM"
            symbol=">="
            above="TAN"
            below="ATB"
          />
          <Key
            zoom={this._zoom}
            code={13}
            keyAction={this.handleClick}
            main="R"
            keyword="RUN"
            symbol="<"
            above="INT"
            below="VERIFY"
          />
          <Key
            zoom={this._zoom}
            code={14}
            keyAction={this.handleClick}
            main="T"
            keyword="RAND"
            symbol=">"
            above="RND"
            below="MERGE"
          />
          <Key
            zoom={this._zoom}
            code={29}
            keyAction={this.handleClick}
            main="Y"
            keyword="RETURN"
            symbolWord="AND"
            above="STR$"
            below="["
          />
          <Key
            zoom={this._zoom}
            code={28}
            keyAction={this.handleClick}
            main="U"
            keyword="IF"
            symbolWord="OR"
            above="CHR$"
            below="]"
          />
          <Key
            zoom={this._zoom}
            code={27}
            keyAction={this.handleClick}
            main="I"
            keyword="INPUT"
            symbolWord="AT"
            above="CODE"
            below="IN"
          />
          <Key
            zoom={this._zoom}
            code={26}
            keyAction={this.handleClick}
            main="O"
            keyword="POKE"
            symbol=";"
            above="PEEK"
            below="OUT"
          />
          <Key
            zoom={this._zoom}
            code={25}
            keyAction={this.handleClick}
            main="P"
            keyword="PRINT"
            symbol={'"'}
            above="TAB"
            below="(C)"
          />
        </div>
        <div className="key-row" style={{ marginLeft: row2Shift }}>
          <Key
            zoom={this._zoom}
            code={5}
            keyAction={this.handleClick}
            main="A"
            keyword="NEW"
            symbolWord="STOP"
            above="READ"
            below="~"
          />
          <Key
            zoom={this._zoom}
            code={6}
            keyAction={this.handleClick}
            main="S"
            keyword="SAVE"
            symbolWord="NOT"
            above="RESTORE"
            below="|"
          />
          <Key
            zoom={this._zoom}
            code={7}
            keyAction={this.handleClick}
            main="D"
            keyword="DIM"
            symbolWord="STEP"
            above="DATA"
            below="\"
          />
          <Key
            zoom={this._zoom}
            code={8}
            keyAction={this.handleClick}
            main="F"
            keyword="FOR"
            symbolWord="TO"
            above="SGN"
            below={"{"}
          />
          <Key
            zoom={this._zoom}
            code={9}
            keyAction={this.handleClick}
            main="G"
            keyword="GOTO"
            symbolWord="THEN"
            above="ABS"
            below="}"
          />
          <Key
            zoom={this._zoom}
            code={34}
            keyAction={this.handleClick}
            main="H"
            keyword="GOSUB"
            symbol={"\u2191"}
            above="SQR"
            below="CIRCLE"
          />
          <Key
            zoom={this._zoom}
            code={33}
            keyAction={this.handleClick}
            main="J"
            keyword="LOAD"
            symbol={"\u2212"}
            above="VAL"
            below="VAL$"
          />
          <Key
            zoom={this._zoom}
            code={32}
            keyAction={this.handleClick}
            main="K"
            keyword="LIST"
            symbol="+"
            above="LEN"
            below="SCREEN$"
          />
          <Key
            zoom={this._zoom}
            code={31}
            keyAction={this.handleClick}
            main="L"
            keyword="LET"
            symbol="="
            above="USR"
            below="ATTR"
          />
          <Key
            zoom={this._zoom}
            code={30}
            keyAction={this.handleClick}
            center="ENTER"
          />
        </div>
        <div className="key-row">
          <Key
            zoom={this._zoom}
            code={0}
            keyAction={this.handleClick}
            xwidth={130}
            top="CAPS"
            bottom="SHIFT"
          />
          <Key
            zoom={this._zoom}
            code={1}
            keyAction={this.handleClick}
            main="Z"
            keyword="COPY"
            symbol=":"
            above="LN"
            below="BEEP"
          />
          <Key
            zoom={this._zoom}
            code={2}
            keyAction={this.handleClick}
            main="X"
            keyword="CLEAR"
            symbol={"\u00a3"}
            above="EXP"
            below="INK"
          />
          <Key
            zoom={this._zoom}
            code={3}
            keyAction={this.handleClick}
            main="C"
            keyword="CONT"
            symbol="?"
            above="LPRINT"
            below="PAPER"
          />
          <Key
            zoom={this._zoom}
            code={4}
            keyAction={this.handleClick}
            main="V"
            keyword="CLS"
            symbol="/"
            above="LLIST"
            below="FLASH"
          />
          <Key
            zoom={this._zoom}
            code={39}
            keyAction={this.handleClick}
            main="B"
            keyword="BORDER"
            symbol="*"
            above="BIN"
            below="BRIGHT"
          />
          <Key
            zoom={this._zoom}
            code={38}
            keyAction={this.handleClick}
            main="N"
            keyword="NEXT"
            symbol=","
            above="INKEY$"
            below="OVER"
          />
          <Key
            zoom={this._zoom}
            code={37}
            keyAction={this.handleClick}
            main="M"
            keyword="PAUSE"
            symbol="."
            above="INVERSE"
            below="PI"
          />
          <Key
            zoom={this._zoom}
            code={36}
            keyAction={this.handleClick}
            top="SYMBOL"
            bottom="SHIFT"
            useSymColor={true}
          />
          <Key
            zoom={this._zoom}
            code={35}
            keyAction={this.handleClick}
            xwidth={180}
            top="BREAK"
            center="SPACE"
          />
        </div>
      </div>
    );
  }

  handleClick = (e: Sp48ButtonClickArgs) => {
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

  calculateZoom(width: number, height: number): void {
    if (!width || !height) return;
    let widthRatio = (width - 24) / DEFAULT_WIDTH;
    let heightRatio = (height - 32) / DEFAULT_HEIGHT;
    this._zoom = Math.min(widthRatio, heightRatio);
  }
}
