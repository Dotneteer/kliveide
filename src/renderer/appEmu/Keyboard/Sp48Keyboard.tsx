import { Sp48Key as Key } from "./Sp48Key";
import { Column, Row, KeyboardButtonClickArgs } from "./keyboard-common";
import { CSSProperties } from "react";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";

const DEFAULT_WIDTH = 10 * 104 + 130;
const DEFAULT_HEIGHT = 4 * (128 + 16);

type Props = {
  width: number;
  height: number;
};

export const Sp48Keyboard = ({ width, height }: Props) => {
  const { machineService } = useAppServices();
  const zoom = calculateZoom(width, height);
  const row1Shift = 80 * zoom;
  const row2Shift = 110 * zoom;
  return (
    <Column width='auto' style={rootStyle}>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          code={15}
          keyAction={handleClick}
          topNum='BLUE'
          topNumColor='#0030ff'
          main='1'
          symbol={"\xa0\xa0!\xa0\xa0"}
          above='EDIT'
          below='DEF FN'
          glyph={1}
        />
        <Key
          zoom={zoom}
          code={16}
          keyAction={handleClick}
          topNum='RED'
          topNumColor='#ff0000'
          main='2'
          symbol={"\xa0@\xa0"}
          above='CAPS LOCK'
          below='FN'
          glyph={2}
        />
        <Key
          zoom={zoom}
          code={17}
          keyAction={handleClick}
          topNum='MAGENTA'
          topNumColor='#e000e0'
          main='3'
          symbol={"\xa0#\xa0"}
          above='TRUE VID'
          below='LINE'
          glyph={3}
        />
        <Key
          zoom={zoom}
          code={18}
          keyAction={handleClick}
          topNum='GREEN'
          topNumColor='#00c000'
          main='4'
          symbol={"\xa0$\xa0"}
          above='INV.VIDEO'
          below='OPEN'
          glyph={4}
        />
        <Key
          zoom={zoom}
          code={19}
          keyAction={handleClick}
          topNum='CYAN'
          topNumColor='#00c0c0'
          main='5'
          symbol={"\xa0%\xa0"}
          above={"\u140a"}
          below='CLOSE'
          glyph={5}
        />
        <Key
          zoom={zoom}
          code={24}
          keyAction={handleClick}
          topNum='YELLOW'
          topNumColor='#fff000'
          main='6'
          symbol={"\xa0&\xa0"}
          above={"\u1401"}
          below='MOVE'
          glyph={6}
        />
        <Key
          zoom={zoom}
          code={23}
          keyAction={handleClick}
          topNum='WHITE'
          topNumColor='#ffffff'
          main='7'
          symbol={"\xa0\xa0'\xa0\xa0"}
          above={"\u1403"}
          below='ERASE'
          glyph={7}
        />
        <Key
          zoom={zoom}
          code={22}
          keyAction={handleClick}
          topNum='UNBRIGHT'
          topNumColor='#a0a0a0'
          main='8'
          symbol={"\xa0\xa0(\xa0\xa0"}
          above={"\u1405"}
          below='POINT'
          glyph={16}
        />
        <Key
          zoom={zoom}
          code={21}
          keyAction={handleClick}
          topNum='BRIGHT'
          main='9'
          symbol={"\xa0\xa0)\xa0\xa0"}
          above='GRAPHICS'
          below='CAT'
        />
        <Key
          zoom={zoom}
          code={20}
          keyAction={handleClick}
          topNum='BLACK'
          topNumColor='#505050'
          main='0'
          symbol={"\uff3f"}
          above='DELETE'
          below='FORMAT'
        />
      </Row>
      <Row height='auto' style={{ ...rowStyle, marginLeft: row1Shift }}>
        <Key
          zoom={zoom}
          code={10}
          keyAction={handleClick}
          main='Q'
          keyword='PLOT'
          symbol='<='
          above='SIN'
          below='ASN'
        />
        <Key
          zoom={zoom}
          code={11}
          keyAction={handleClick}
          main='W'
          keyword='DRAW'
          symbol='<>'
          above='COS'
          below='ACS'
        />
        <Key
          zoom={zoom}
          code={12}
          keyAction={handleClick}
          main='E'
          keyword='REM'
          symbol='>='
          above='TAN'
          below='ATB'
        />
        <Key
          zoom={zoom}
          code={13}
          keyAction={handleClick}
          main='R'
          keyword='RUN'
          symbol={"\xa0<\xa0"}
          above='INT'
          below='VERIFY'
        />
        <Key
          zoom={zoom}
          code={14}
          keyAction={handleClick}
          main='T'
          keyword='RAND'
          symbol={"\xa0>\xa0"}
          above='RND'
          below='MERGE'
        />
        <Key
          zoom={zoom}
          code={29}
          keyAction={handleClick}
          main='Y'
          keyword='RETURN'
          symbolWord='AND'
          above='STR$'
          below='['
        />
        <Key
          zoom={zoom}
          code={28}
          keyAction={handleClick}
          main='U'
          keyword='IF'
          symbolWord='OR'
          above='CHR$'
          below=']'
        />
        <Key
          zoom={zoom}
          code={27}
          keyAction={handleClick}
          main='I'
          keyword='INPUT'
          symbolWord='AT'
          above='CODE'
          below='IN'
        />
        <Key
          zoom={zoom}
          code={26}
          keyAction={handleClick}
          main='O'
          keyword='POKE'
          symbol={"\xa0\xa0;\xa0\xa0"}
          above='PEEK'
          below='OUT'
        />
        <Key
          zoom={zoom}
          code={25}
          keyAction={handleClick}
          main='P'
          keyword='PRINT'
          symbol={'\xa0\xa0"\xa0\xa0'}
          above='TAB'
          below='(C)'
        />
      </Row>
      <Row height='auto' style={{ ...rowStyle, marginLeft: row2Shift }}>
        <Key
          zoom={zoom}
          code={5}
          keyAction={handleClick}
          main='A'
          keyword='NEW'
          symbolWord='STOP'
          above='READ'
          below={"\xa0\xa0~\xa0\xa0"}
        />
        <Key
          zoom={zoom}
          code={6}
          keyAction={handleClick}
          main='S'
          keyword='SAVE'
          symbolWord='NOT'
          above='RESTORE'
          below={"\xa0\xa0|\xa0\xa0"}
        />
        <Key
          zoom={zoom}
          code={7}
          keyAction={handleClick}
          main='D'
          keyword='DIM'
          symbolWord='STEP'
          above='DATA'
          below={"\xa0\xa0\\\xa0\xa0"}
        />
        <Key
          zoom={zoom}
          code={8}
          keyAction={handleClick}
          main='F'
          keyword='FOR'
          symbolWord='TO'
          above='SGN'
          below={"\xa0\xa0{\xa0\xa0"}
        />
        <Key
          zoom={zoom}
          code={9}
          keyAction={handleClick}
          main='G'
          keyword='GOTO'
          symbolWord='THEN'
          above='ABS'
          below={"\xa0\xa0}\xa0\xa0"}
        />
        <Key
          zoom={zoom}
          code={34}
          keyAction={handleClick}
          main='H'
          keyword='GOSUB'
          symbol={"\xa0\u2191\xa0"}
          above='SQR'
          below='CIRCLE'
        />
        <Key
          zoom={zoom}
          code={33}
          keyAction={handleClick}
          main='J'
          keyword='LOAD'
          symbol={"\xa0\u2212\xa0"}
          above='VAL'
          below='VAL$'
        />
        <Key
          zoom={zoom}
          code={32}
          keyAction={handleClick}
          main='K'
          keyword='LIST'
          symbol={"\xa0+\xa0"}
          above='LEN'
          below='SCREEN$'
        />
        <Key
          zoom={zoom}
          code={31}
          keyAction={handleClick}
          main='L'
          keyword='LET'
          symbol={"\xa0=\xa0"}
          above='USR'
          below='ATTR'
        />
        <Key zoom={zoom} code={30} keyAction={handleClick} center='ENTER' />
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          code={0}
          keyAction={handleClick}
          xwidth={130}
          top='CAPS'
          bottom='SHIFT'
        />
        <Key
          zoom={zoom}
          code={1}
          keyAction={handleClick}
          main='Z'
          keyword='COPY'
          symbol={"\xa0\xa0:\xa0\xa0"}
          above='LN'
          below='BEEP'
        />
        <Key
          zoom={zoom}
          code={2}
          keyAction={handleClick}
          main='X'
          keyword='CLEAR'
          symbol={"\xa0\u00a3\xa0"}
          above='EXP'
          below='INK'
        />
        <Key
          zoom={zoom}
          code={3}
          keyAction={handleClick}
          main='C'
          keyword='CONT'
          symbol={"\xa0?\xa0"}
          above='LPRINT'
          below='PAPER'
        />
        <Key
          zoom={zoom}
          code={4}
          keyAction={handleClick}
          main='V'
          keyword='CLS'
          symbol={"\xa0/\xa0"}
          above='LLIST'
          below='FLASH'
        />
        <Key
          zoom={zoom}
          code={39}
          keyAction={handleClick}
          main='B'
          keyword='BORDER'
          symbol={"\xa0*\xa0"}
          above='BIN'
          below='BRIGHT'
        />
        <Key
          zoom={zoom}
          code={38}
          keyAction={handleClick}
          main='N'
          keyword='NEXT'
          symbol={"\xa0\xa0,\xa0\xa0"}
          above='INKEY$'
          below='OVER'
        />
        <Key
          zoom={zoom}
          code={37}
          keyAction={handleClick}
          main='M'
          keyword='PAUSE'
          symbol={"\xa0\xa0.\xa0\xa0"}
          above='INVERSE'
          below='PI'
        />
        <Key
          zoom={zoom}
          code={36}
          keyAction={handleClick}
          top='SYMBOL'
          bottom='SHIFT'
          useSymColor={true}
        />
        <Key
          zoom={zoom}
          code={35}
          keyAction={handleClick}
          xwidth={180}
          top='BREAK'
          center='SPACE'
        />
      </Row>
    </Column>
  );

  function handleClick (e: KeyboardButtonClickArgs): void {
    const machine = machineService.getMachineController().machine;
    if (!machine || machine.getKeyQueueLength() > 0) return;

    switch (e.keyCategory) {
      case "main":
        setKeyStatus(
          e.down,
          e.code,
          e.button === 0 ? undefined : 0 /* CShift */
        );
        break;
      case "symbol":
        setKeyStatus(e.down, e.code, 36 /* SShift */);
        break;
      case "above":
        if (e.down) {
          machine.queueKeystroke(0, 2, 0 /* CShift */, 36 /* SShift */);
          machine.queueKeystroke(
            3,
            2,
            e.code,
            undefined
          );
        }
        break;
      case "below":
        if (e.down) {
          machine.queueKeystroke(0, 2, 0 /* CShift */, 36 /* SShift */);
          machine.queueKeystroke(3, 2, e.code, 36 /* SShift */);
        }
        break;
      case "topNum":
        setKeyStatus(e.down, e.code, 0);
        break;
      case "glyph":
        if (((machine as ZxSpectrumBase).getCursorMode() & 0x02) !== 0) return;
        if (e.down) {
          machine.queueKeystroke(0, 2, 21 /* N9 */, 0 /* CShift */);
          machine.queueKeystroke(
            3,
            2,
            e.code,
            e.button === 0 ? undefined : 0 /* CShift */
          );
          machine.queueKeystroke(10, 2, 21 /* N9 */, 0 /* CShift */);
        }
        break;
    }

    /**
     * Sets the status of the specified keys
     * @param down Is pressed down?
     * @param primary Primary key
     * @param secondary Optional secondary key
     */
    function setKeyStatus (
      down: boolean,
      primary: number,
      secondary?: number
    ): void {
      machine.setKeyStatus(primary, down);
      if (secondary !== undefined) {
        machine.setKeyStatus(secondary, down);
      }
    }
  }

  function calculateZoom (width: number, height: number): number {
    if (!width || !height) return 0.05;
    let widthRatio = (width - 24) / DEFAULT_WIDTH;
    let heightRatio = (height - 12) / DEFAULT_HEIGHT;
    return Math.min(widthRatio, heightRatio);
  }
};

const rootStyle: CSSProperties = {
  boxSizing: "border-box",
  flexDirection: "column",
  alignContent: "start",
  justifyItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  userSelect: "none"
};

const rowStyle: CSSProperties = {
  padding: "0px 0px",
  fontWeight: "bold"
};
