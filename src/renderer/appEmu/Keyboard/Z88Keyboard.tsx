import { Column, Row } from "./keyboard-common";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { KeyboardApi } from "./KeyboardPanel";
import { KeyPressMapper } from "./KeyPressMapper";
import {
  Z88KeyboardLayout,
  esZ88KeyboardLayout,
  frZ88KeyboardLayout,
  itZ88KeyboardLayout,
  deZ88KeyboardLayout,
  dkZ88KeyboardLayout,
  seZ88KeyboardLayout,
  defaultZ88KeyboardLayout
} from "@emu/machines/z88/Z88KeyLayout";
import { Z88Key as Key, Z88ButtonClickArgs } from "./Z88Key";

// --- Keyboard dimensions
const DEFAULT_WIDTH = 15 * 100 + 16;
const DEFAULT_HEIGHT = 5 * (100 + 16);

// --- Special key codes
const LEFT_SHIFT_KEY = 54;
const SQUARE_KEY = 62;
const DIAMOND_KEY = 52;

type Props = {
  width: number;
  height: number;
  layout?: string;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const Z88Keyboard = ({ width, height, layout, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const zoom = calculateZoom(width, height);
  const mounted = useRef(false);
  const keystatus = useRef(new KeyPressMapper());
  const [version, setVersion] = useState(1);

  // --- Prepare keyboard layout information
  let l: Z88KeyboardLayout;
  switch (layout) {
    case "es":
      l = esZ88KeyboardLayout;
      break;
    case "fr":
      l = frZ88KeyboardLayout;
      break;
    case "it":
      l = itZ88KeyboardLayout;
      break;
    case "de":
      l = deZ88KeyboardLayout;
      break;
    case "dk":
      l = dkZ88KeyboardLayout;
      break;
    case "se":
      l = seZ88KeyboardLayout;
      break;
    default:
      l = defaultZ88KeyboardLayout;
      break;
  }

  const api: KeyboardApi = {
    signKeyStatus: (code, down) => {
      keystatus.current.setKeyStatus(code, down);
      setVersion(version + 1);
    }
  };

  const isPressed = (code: number) => keystatus.current.isPressed(code);

  // --- Mount the kayboard API
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
          code={61}
          layoutInfo={l.Escape}
          keyAction={click}
          pressed={isPressed(61)}
        />
        <Key
          zoom={zoom}
          code={45}
          layoutInfo={l.N1}
          keyAction={click}
          pressed={isPressed(45)}
        />
        <Key
          zoom={zoom}
          code={37}
          layoutInfo={l.N2}
          keyAction={click}
          pressed={isPressed(37)}
        />
        <Key
          zoom={zoom}
          code={29}
          layoutInfo={l.N3}
          keyAction={click}
          pressed={isPressed(29)}
        />
        <Key
          zoom={zoom}
          code={21}
          layoutInfo={l.N4}
          keyAction={click}
          pressed={isPressed(21)}
        />
        <Key
          zoom={zoom}
          code={13}
          layoutInfo={l.N5}
          keyAction={click}
          pressed={isPressed(13)}
        />
        <Key
          zoom={zoom}
          code={5}
          layoutInfo={l.N6}
          keyAction={click}
          pressed={isPressed(5)}
        />
        <Key
          zoom={zoom}
          code={1}
          layoutInfo={l.N7}
          keyAction={click}
          pressed={isPressed(1)}
        />
        <Key
          zoom={zoom}
          code={0}
          layoutInfo={l.N8}
          keyAction={click}
          pressed={isPressed(0)}
        />
        <Key
          zoom={zoom}
          code={24}
          layoutInfo={l.N9}
          keyAction={click}
          pressed={isPressed(24)}
        />
        <Key
          zoom={zoom}
          code={40}
          layoutInfo={l.N0}
          keyAction={click}
          pressed={isPressed(40)}
        />
        <Key
          zoom={zoom}
          code={31}
          layoutInfo={l.Minus}
          keyAction={click}
          pressed={isPressed(31)}
        />
        <Key
          zoom={zoom}
          code={23}
          layoutInfo={l.Equal}
          keyAction={click}
          pressed={isPressed(23)}
        />
        <Key
          zoom={zoom}
          code={15}
          layoutInfo={l.Backslash}
          keyAction={click}
          pressed={isPressed(15)}
        />
        <Key
          zoom={zoom}
          code={7}
          layoutInfo={l.Delete}
          keyAction={click}
          pressed={isPressed(7)}
        />
      </Row>
      <Row height='auto' style={row23Style}>
        <div style={{ margin: 0 }}>
          <Row height='auto' style={rowStyle}>
            <Key
              zoom={zoom}
              code={53}
              layoutInfo={l.Tab}
              keyAction={click}
              xwidth={140}
              pressed={isPressed(53)}
            />
            <Key
              zoom={zoom}
              code={44}
              layoutInfo={l.Q}
              keyAction={click}
              pressed={isPressed(44)}
            />
            <Key
              zoom={zoom}
              code={36}
              layoutInfo={l.W}
              keyAction={click}
              pressed={isPressed(36)}
            />
            <Key
              zoom={zoom}
              code={28}
              layoutInfo={l.E}
              keyAction={click}
              pressed={isPressed(28)}
            />
            <Key
              zoom={zoom}
              code={20}
              layoutInfo={l.R}
              keyAction={click}
              pressed={isPressed(20)}
            />
            <Key
              zoom={zoom}
              code={12}
              layoutInfo={l.T}
              keyAction={click}
              pressed={isPressed(12)}
            />
            <Key
              zoom={zoom}
              code={4}
              layoutInfo={l.Y}
              keyAction={click}
              pressed={isPressed(4)}
            />
            <Key
              zoom={zoom}
              code={9}
              layoutInfo={l.U}
              keyAction={click}
              pressed={isPressed(9)}
            />
            <Key
              zoom={zoom}
              code={8}
              layoutInfo={l.I}
              keyAction={click}
              pressed={isPressed(8)}
            />
            <Key
              zoom={zoom}
              code={16}
              layoutInfo={l.O}
              keyAction={click}
              pressed={isPressed(16)}
            />
            <Key
              zoom={zoom}
              code={32}
              layoutInfo={l.P}
              keyAction={click}
              pressed={isPressed(32)}
            />
            <Key
              zoom={zoom}
              code={47}
              layoutInfo={l.SBracketL}
              keyAction={click}
              pressed={isPressed(47)}
            />
            <Key
              zoom={zoom}
              code={39}
              layoutInfo={l.SBracketR}
              keyAction={click}
              pressed={isPressed(39)}
            />
          </Row>
          <Row height='auto' style={rowStyle}>
            <Key
              zoom={zoom}
              code={52}
              layoutInfo={l.Diamond}
              keyAction={click}
              vshift={8}
              fontSize={60}
              xwidth={180}
              pressed={isPressed(52)}
            />
            <Key
              zoom={zoom}
              code={43}
              layoutInfo={l.A}
              keyAction={click}
              pressed={isPressed(43)}
            />
            <Key
              zoom={zoom}
              code={35}
              layoutInfo={l.S}
              keyAction={click}
              pressed={isPressed(35)}
            />
            <Key
              zoom={zoom}
              code={27}
              layoutInfo={l.D}
              keyAction={click}
              pressed={isPressed(27)}
            />
            <Key
              zoom={zoom}
              code={19}
              layoutInfo={l.F}
              keyAction={click}
              pressed={isPressed(19)}
            />
            <Key
              zoom={zoom}
              code={11}
              layoutInfo={l.G}
              keyAction={click}
              pressed={isPressed(11)}
            />
            <Key
              zoom={zoom}
              code={3}
              layoutInfo={l.H}
              keyAction={click}
              pressed={isPressed(3)}
            />
            <Key
              zoom={zoom}
              code={17}
              layoutInfo={l.J}
              keyAction={click}
              pressed={isPressed(17)}
            />
            <Key
              zoom={zoom}
              code={25}
              layoutInfo={l.K}
              keyAction={click}
              pressed={isPressed(25)}
            />
            <Key
              zoom={zoom}
              code={41}
              layoutInfo={l.L}
              keyAction={click}
              pressed={isPressed(41)}
            />
            <Key
              zoom={zoom}
              code={49}
              layoutInfo={l.Semicolon}
              keyAction={click}
              pressed={isPressed(49)}
            />
            <Key
              zoom={zoom}
              code={48}
              layoutInfo={l.Quote}
              keyAction={click}
              pressed={isPressed(48)}
            />
            <Key
              zoom={zoom}
              code={56}
              layoutInfo={l.Pound}
              keyAction={click}
              pressed={isPressed(56)}
            />
          </Row>
        </div>
        <div style={enterStyle}>
          <Key
            zoom={zoom}
            code={6}
            keyAction={click}
            isEnter={true}
            xwidth={122}
            xheight={200}
            pressed={isPressed(6)}
          />
        </div>
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          code={54}
          layoutInfo={l.ShiftL}
          keyAction={click}
          xwidth={240}
          pressed={isPressed(54)}
        />
        <Key
          zoom={zoom}
          code={42}
          layoutInfo={l.Z}
          keyAction={click}
          pressed={isPressed(42)}
        />
        <Key
          zoom={zoom}
          code={34}
          layoutInfo={l.X}
          keyAction={click}
          pressed={isPressed(34)}
        />
        <Key
          zoom={zoom}
          code={26}
          layoutInfo={l.C}
          keyAction={click}
          pressed={isPressed(26)}
        />
        <Key
          zoom={zoom}
          code={18}
          layoutInfo={l.V}
          keyAction={click}
          pressed={isPressed(18)}
        />
        <Key
          zoom={zoom}
          code={10}
          layoutInfo={l.B}
          keyAction={click}
          pressed={isPressed(10)}
        />
        <Key
          zoom={zoom}
          code={2}
          layoutInfo={l.N}
          keyAction={click}
          pressed={isPressed(2)}
        />
        <Key
          zoom={zoom}
          code={33}
          layoutInfo={l.M}
          keyAction={click}
          pressed={isPressed(33)}
        />
        <Key
          zoom={zoom}
          code={50}
          layoutInfo={l.Comma}
          keyAction={click}
          pressed={isPressed(50)}
        />
        <Key
          zoom={zoom}
          code={58}
          layoutInfo={l.Period}
          keyAction={click}
          pressed={isPressed(58)}
        />
        <Key
          zoom={zoom}
          code={57}
          layoutInfo={l.Slash}
          keyAction={click}
          pressed={isPressed(57)}
        />
        <Key
          zoom={zoom}
          code={63}
          layoutInfo={l.ShiftR}
          keyAction={click}
          xwidth={160}
          pressed={isPressed(63)}
        />
        <Key
          zoom={zoom}
          code={14}
          layoutInfo={l.Up}
          keyAction={click}
          vshift={8}
          fontSize={60}
          pressed={isPressed(14)}
        />
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key
          zoom={zoom}
          code={60}
          layoutInfo={l.Index}
          keyAction={click}
          pressed={isPressed(60)}
        />
        <Key
          zoom={zoom}
          code={51}
          layoutInfo={l.Menu}
          keyAction={click}
          pressed={isPressed(51)}
        />
        <Key
          zoom={zoom}
          code={55}
          layoutInfo={l.Help}
          keyAction={click}
          pressed={isPressed(55)}
        />
        <Key
          zoom={zoom}
          code={62}
          layoutInfo={l.Square}
          keyAction={click}
          vshift={8}
          fontSize={60}
          pressed={isPressed(62)}
        />
        <Key
          zoom={zoom}
          code={46}
          layoutInfo={l.Space}
          keyAction={click}
          xwidth={702}
          pressed={isPressed(46)}
        />
        <Key
          zoom={zoom}
          code={59}
          keyAction={click}
          top='CAPS'
          bottom='LOCK'
          pressed={isPressed(59)}
        />
        <Key
          zoom={zoom}
          code={38}
          layoutInfo={l.Left}
          keyAction={click}
          fontSize={60}
          vshift={8}
          pressed={isPressed(38)}
        />
        <Key
          zoom={zoom}
          code={30}
          layoutInfo={l.Right}
          keyAction={click}
          vshift={8}
          fontSize={60}
          pressed={isPressed(30)}
        />
        <Key
          zoom={zoom}
          code={22}
          layoutInfo={l.Down}
          keyAction={click}
          vshift={8}
          fontSize={60}
          pressed={isPressed(22)}
        />
      </Row>
    </Column>
  );

  function calculateZoom (width: number, height: number): number {
    if (!width || !height) return 0.05;
    let widthRatio = (width - 24) / DEFAULT_WIDTH;
    let heightRatio = (height - 12) / DEFAULT_HEIGHT;
    return Math.min(widthRatio, heightRatio);
  }

  function click (e: Z88ButtonClickArgs): void {
    const machine = machineService.getMachineController().machine;
    // --- Set status of the primary key
    machine.setKeyStatus(e.code, e.down);
    // --- Set status of the secondary key
    switch (e.iconCount) {
      case 0:
      case 1:
        if (!e.isLeft) {
          machine.setKeyStatus(LEFT_SHIFT_KEY, e.down);
        }
        break;
      case 2:
        if (e.keyCategory === "symbol") {
          machine.setKeyStatus(e.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY, e.down);
        }
        break;
      case 3:
        if (e.keyCategory === "key" && !e.isLeft) {
          machine.setKeyStatus(LEFT_SHIFT_KEY, e.down);
        } else if (e.keyCategory === "symbol") {
          if (e.special === "dk") {
            machine.setKeyStatus(SQUARE_KEY, e.down);
          } else {
            machine.setKeyStatus(
              e.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY,
              e.down
            );
          }
        } else if (e.keyCategory === "secondSymbol" && e.isLeft) {
          machine.setKeyStatus(DIAMOND_KEY, e.down);
        }
        break;
    }
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

const row23Style: CSSProperties = {
  flexDirection: "row"
};

const enterStyle: CSSProperties = {
  display: "flex",
  flexGrow: 0,
  flexShrink: 0,
  fontWeight: "bold",
  margin: 0
};
