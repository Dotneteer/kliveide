import { Sp128Key as Key } from "./Sp128Key";
import { Column, Row, KeyboardButtonClickArgs } from "./keyboard-common";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";
import { Sp128EnterKeyTop } from "./Sp128EnterKeyTop";
import { Sp128EnterKeyBottom } from "./Sp128EnterKeyBottom";
import { KeyboardApi } from "./KeyboardPanel";
import { KeyPressMapper } from "./KeyPressMapper";

const DEFAULT_WIDTH = 14 * 75 + 20;
const DEFAULT_HEIGHT = 5 * 77 + 32;

type Props = {
  width: number;
  height: number;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const Sp128Keyboard = ({ width, height, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const [hilited, setHilited] = useState(false);
  const zoom = calculateZoom(width, height);
  const mounted = useRef(false);
  const keystatus = useRef(new KeyPressMapper());
  const [version, setVersion] = useState(1);

  const api: KeyboardApi = {
    signKeyStatus: (code, down) => {
      keystatus.current.setKeyStatus(code, down);
      setVersion(version + 1);
    }
  };

  const isPressed = (code: number, secondary?: number) =>
    keystatus.current.isPressed(code, secondary);

  useEffect(() => {
    if (mounted.current) return null;
    mounted.current = true;
    apiLoaded?.(api);

    return () => {
      mounted.current = false;
    };
  });

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
          pressed={isPressed(18, 0)}
        />
        <Key
          zoom={zoom}
          code={17}
          secondaryCode={0}
          keyAction={handleClick}
          keyword='TRUE'
          symbolWord='VIDEO'
          cleanMode={true}
          pressed={isPressed(17, 0)}
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
          pressed={isPressed(15)}
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
          pressed={isPressed(16)}
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
          pressed={isPressed(17)}
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
          pressed={isPressed(18)}
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
          pressed={isPressed(19)}
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
          pressed={isPressed(24)}
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
          pressed={isPressed(23)}
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
          pressed={isPressed(22)}
        />
        <Key
          zoom={zoom}
          code={21}
          keyAction={handleClick}
          numMode={true}
          main='9'
          symbol={"\xa0\xa0)\xa0\xa0"}
          below='CAT'
          pressed={isPressed(21)}
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
          pressed={isPressed(20)}
        />
        <Key
          zoom={zoom}
          xwidth={110}
          code={35}
          secondaryCode={0}
          keyAction={handleClick}
          center='BREAK'
          pressed={isPressed(35, 0)}
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
          pressed={isPressed(20, 0)}
        />
        <Key
          zoom={zoom}
          code={21}
          secondaryCode={0}
          keyAction={handleClick}
          center='GRAPH'
          pressed={isPressed(21,0)}
        />
        <Key
          zoom={zoom}
          code={10}
          keyAction={handleClick}
          main='Q'
          keyword='PLOT'
          symbol='<='
          above='SIN'
          below='ASN'
          pressed={isPressed(10)}
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
          pressed={isPressed(11)}
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
          pressed={isPressed(12)}
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
          pressed={isPressed(13)}
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
          pressed={isPressed(14)}
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
          pressed={isPressed(29)}
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
          pressed={isPressed(28)}
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
          pressed={isPressed(27)}
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
          pressed={isPressed(26)}
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
          pressed={isPressed(25)}
        />
        <Sp128EnterKeyTop
          zoom={zoom}
          mouseOnKey={() => setHilited(true)}
          mouseOutOfKey={() => setHilited(false)}
          mouseDown={() =>
            handleClick({
              button: 0,
              code: 30,
              keyCategory: "main",
              down: true
            })
          }
          mouseUp={() =>
            handleClick({
              button: 0,
              code: 30,
              keyCategory: "main",
              down: false
            })
          }
          pressed={isPressed(30)}
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
          pressed={isPressed(36, 0)}
        />
        <Key
          zoom={zoom}
          xwidth={95}
          code={15}
          secondaryCode={0}
          keyAction={handleClick}
          center='EDIT'
          pressed={isPressed(15)}
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
          pressed={isPressed(5)}
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
          pressed={isPressed(6)}
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
          pressed={isPressed(7)}
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
          pressed={isPressed(8)}
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
          pressed={isPressed(9)}
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
          pressed={isPressed(34)}
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
          pressed={isPressed(33)}
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
          pressed={isPressed(32)}
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
          pressed={isPressed(31)}
          />
        <Sp128EnterKeyBottom
          zoom={zoom}
          hilited={hilited}
          pressed={isPressed(30)}
          mouseDown={() =>
            handleClick({
              button: 0,
              code: 30,
              keyCategory: "main",
              down: true
            })
          }
          mouseUp={() =>
            handleClick({
              button: 0,
              code: 30,
              keyCategory: "main",
              down: false
            })
          }
        />
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          xwidth={170}
          code={0}
          keyAction={handleClick}
          keyword='CAPS'
          symbolWord='SHIFT'
          cleanMode={true}
          pressed={isPressed(0)}
          />
        <Key
          zoom={zoom}
          code={16}
          secondaryCode={0}
          keyAction={handleClick}
          keyword='CAPS'
          symbolWord='LOCK'
          cleanMode={true}
          pressed={isPressed(16, 0)}
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
          pressed={isPressed(1)}
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
          pressed={isPressed(2)}
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
          pressed={isPressed(3)}
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
          pressed={isPressed(4)}
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
          pressed={isPressed(39)}
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
          pressed={isPressed(38)}
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
          pressed={isPressed(37)}
          />
        <Key
          zoom={zoom}
          code={37}
          secondaryCode={36}
          keyAction={handleClick}
          main='.'
          pressed={isPressed(37, 36)}
          />
        <Key
          zoom={zoom}
          xwidth={170}
          code={0}
          keyAction={handleClick}
          keyword='CAPS'
          symbolWord='SHIFT'
          cleanMode={true}
          pressed={isPressed(0)}
        />
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          code={36}
          keyAction={handleClick}
          keyword='SYMBOL'
          symbolWord='SHIFT'
          cleanMode={true}
          pressed={isPressed(36)}
        />
        <Key
          zoom={zoom}
          code={26}
          secondaryCode={36}
          keyAction={handleClick}
          main=';'
          centerMode={true}
          pressed={isPressed(26, 36)}
          />
        <Key
          zoom={zoom}
          code={25}
          secondaryCode={36}
          keyAction={handleClick}
          main='"'
          centerMode={true}
          pressed={isPressed(25, 36)}
          />
        <Key
          zoom={zoom}
          code={19}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25c0"}
          centerMode={true}
          pressed={isPressed(19, 0)}
          />
        <Key
          zoom={zoom}
          code={22}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25b6"}
          centerMode={true}
          pressed={isPressed(22,0)}
          />
        <Key
          zoom={zoom}
          xwidth={342}
          code={35}
          keyAction={handleClick}
          centerMode={true}
          pressed={isPressed(35)}
          />
        <Key
          zoom={zoom}
          code={23}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25b2"}
          centerMode={true}
          pressed={isPressed(23, 0)}
          />
        <Key
          zoom={zoom}
          code={24}
          secondaryCode={0}
          keyAction={handleClick}
          main={"\u25bc"}
          centerMode={true}
          pressed={isPressed(24,0)}
          />
        <Key
          zoom={zoom}
          code={38}
          secondaryCode={36}
          keyAction={handleClick}
          main=','
          centerMode={true}
          pressed={isPressed(38, 36)}
          />
        <Key
          zoom={zoom}
          code={36}
          keyAction={handleClick}
          keyword='SYMBOL'
          symbolWord='SHIFT'
          cleanMode={true}
          pressed={isPressed(36)}
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
