import { Sp128Key as Key } from "./Sp128Key";
import { Column, Row, KeyboardButtonClickArgs } from "./keyboard-common";
import { CSSProperties } from "react";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";

const DEFAULT_WIDTH = 14 * 75 + 20;
const DEFAULT_HEIGHT = 5 * 77 + 32;

type Props = {
  width: number;
  height: number;
};

export const Sp128Keyboard = ({ width, height }: Props) => {
  const { machineService } = useAppServices();
  const zoom = calculateZoom(width, height);
  return (
    <Column width='auto' style={rootStyle}>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          code={18}
          secondaryCode={0}
          keyAction={handleClick}
          keyword='INV'
          symbolWord='VIDEO'
          cleanMode={true}
        />
        <Key
          zoom={zoom}
          code={17}
          secondaryCode={0}
          keyAction={handleClick}
          keyword='TRUE'
          symbolWord='VIDEO'
          cleanMode={true}
        />
        <Key
          zoom={zoom}
          code={15}
          keyAction={handleClick}
          numMode={true}
          main='1'
          symbol={"\xa0!\xa0"}
          above='BLUE'
          below='DEF FN'
          glyph={1}
        />
        <Key
          zoom={zoom}
          code={16}
          keyAction={handleClick}
          numMode={true}
          main='2'
          symbol={"\xa0@\xa0"}
          above='RED'
          below='FN'
          glyph={2}
        />
        <Key
          zoom={zoom}
          code={17}
          keyAction={handleClick}
          numMode={true}
          main='3'
          symbol={"\xa0#\xa0"}
          above='MAGENTA'
          below='LINE'
          glyph={3}
        />
        <Key
          zoom={zoom}
          code={18}
          keyAction={handleClick}
          numMode={true}
          main='4'
          symbol={"\xa0$\xa0"}
          above='GREEN'
          below='OPEN #'
          glyph={4}
        />
        <Key
          zoom={zoom}
          code={19}
          keyAction={handleClick}
          numMode={true}
          main='5'
          symbol={"\xa0%\xa0"}
          above='CYAN'
          below='CLOSE #'
          glyph={5}
        />
        <Key
          zoom={zoom}
          code={24}
          keyAction={handleClick}
          numMode={true}
          main='6'
          symbol={"\xa0&\xa0"}
          above='YELLOW'
          below='MOVE'
          glyph={6}
        />
        <Key
          zoom={zoom}
          code={23}
          keyAction={handleClick}
          numMode={true}
          main='7'
          symbol={"\xa0\xa0'\xa0\xa0"}
          above='WHITE'
          below='ERASE'
          glyph={7}
        />
        <Key
          zoom={zoom}
          code={22}
          keyAction={handleClick}
          main='8'
          numMode={true}
          symbol={"\xa0\xa0(\xa0\xa0"}
          below='POINT'
          glyph={16}
        />
        <Key
          zoom={zoom}
          code={21}
          keyAction={handleClick}
          numMode={true}
          main='9'
          symbol={"\xa0\xa0)\xa0\xa0"}
          below='CAT'
        />
        <Key
          zoom={zoom}
          code={20}
          keyAction={handleClick}
          numMode={true}
          main='0'
          symbol={"\uff3f"}
          above='BLACK'
          below='FORMAT'
        />
        <Key
          zoom={zoom}
          xwidth={110}
          code={35}
          secondaryCode={0}
          keyAction={handleClick}
          center='BREAK'
        />
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          xwidth={110}
          code={20}
          secondaryCode={0}
          keyAction={handleClick}
          center='DELETE'
        />
        <Key zoom={zoom} code={21} secondaryCode={0} keyAction={handleClick} center='GRAPH' />
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
          below='ATN'
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
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          xwidth={110}
          code={36}
          secondaryCode={0}
          keyAction={handleClick}
          keyword='EXTEND'
          symbolWord='MODE'
          cleanMode={true}
        />
        <Key
          zoom={zoom}
          xwidth={95}
          code={15}
          secondaryCode={0}
          keyAction={handleClick}
          center='EDIT'
        />
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
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          xwidth={168}
          code={0}
          keyAction={handleClick}
          keyword='CAPS'
          symbolWord='SHIFT'
          cleanMode={true}
        />
        <Key
          zoom={zoom}
          code={16}
          secondaryCode={0}
          keyAction={handleClick}
          keyword='CAPS'
          symbolWord='LOCK'
          cleanMode={true}
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
          above='PI'
          below='INVERSE'
        />
        <Key zoom={zoom} code={37} secondaryCode={36} keyAction={handleClick} main='.' />
        <Key
          zoom={zoom}
          xwidth={167}
          code={0}
          keyAction={handleClick}
          keyword='CAPS'
          symbolWord='SHIFT'
          cleanMode={true}
        />
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          code={0}
          keyAction={handleClick}
          keyword='SYMBOL'
          symbolWord='SHIFT'
          cleanMode={true}
        />
        <Key
          zoom={zoom}
          code={26}
          secondaryCode={36}
          keyAction={handleClick}
          main=';'
          centerMode={true}
        />
        <Key
          zoom={zoom}
          code={25}
          secondaryCode={36}
          keyAction={handleClick}
          main='"'
          centerMode={true}
        />
        <Key
          zoom={zoom}
          code={19}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25c0"}
          centerMode={true}
        />
        <Key
          zoom={zoom}
          code={22}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25b6"}
          centerMode={true}
        />
        <Key
          zoom={zoom}
          xwidth={338}
          code={35}
          keyAction={handleClick}
          centerMode={true}
        />
        <Key
          zoom={zoom}
          code={23}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25b2"}
          centerMode={true}
        />
        <Key
          zoom={zoom}
          code={24}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25bc"}
          centerMode={true}
        />
        <Key
          zoom={zoom}
          code={38}
          secondaryCode={36}
          keyAction={handleClick}
          main=','
          centerMode={true}
        />
        <Key
          zoom={zoom}
          code={0}
          keyAction={handleClick}
          keyword='SYMBOL'
          symbolWord='SHIFT'
          cleanMode={true}
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
          e.button === 0
            ? e.secondaryButton === undefined
              ? undefined
              : e.secondaryButton
            : 0 /* CShift */
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
            e.button === 0 ? undefined : 0 /* CShift */
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
          machine.queueKeystroke(6, 2, 21 /* N9 */, 0 /* CShift */);
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
