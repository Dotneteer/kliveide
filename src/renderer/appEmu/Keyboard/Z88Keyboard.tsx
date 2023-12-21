import { Column, Row, KeyboardButtonClickArgs } from "./keyboard-common";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";
import { KeyboardApi } from "./KeyboardPanel";
import { KeyPressMapper } from "./KeyPressMapper";
import {
  Z88KeyboardLayout,
  esZ88KeyboardLayout,
  frZ88KeyboardLayout,
  deZ88KeyboardLayout,
  dkZ88KeyboardLayout,
  seZ88KeyboardLayout,
  defaultZ88KeyboardLayout
} from "@emu/machines/z88/Z88KeyLayout";
import { Z88Key as Key, Z88ButtonClickArgs } from "./Z88Key";

const DEFAULT_WIDTH = 15 * 100 + 16;
const DEFAULT_HEIGHT = 5 * (100 + 16);

type Props = {
  width: number;
  height: number;
  apiLoaded?: (api: KeyboardApi) => void;
};

export const Z88Keyboard = ({ width, height, apiLoaded }: Props) => {
  const { machineService } = useAppServices();
  const zoom = calculateZoom(width, height);
  const mounted = useRef(false);
  const keystatus = useRef(new KeyPressMapper());
  const [version, setVersion] = useState(1);

  // TODO: Get the layout from the machine
  const layout: string = "";
  // --- Prepare keyboard layout information
  let l: Z88KeyboardLayout;
  switch (layout) {
    case "es":
      l = esZ88KeyboardLayout;
      break;
    case "fr":
      l = frZ88KeyboardLayout;
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

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    apiLoaded?.(api);

    return () => {
      mounted.current = false;
    };
  });

  return (
    <Column width='auto' style={rootStyle}>
      <Row height='auto' style={rowStyle}>
        <Key zoom={zoom} code={61} layoutInfo={l.Escape} keyAction={click} />
        <Key zoom={zoom} code={45} layoutInfo={l.N1} keyAction={click} />
        <Key zoom={zoom} code={37} layoutInfo={l.N2} keyAction={click} />
        <Key zoom={zoom} code={29} layoutInfo={l.N3} keyAction={click} />
        <Key zoom={zoom} code={21} layoutInfo={l.N4} keyAction={click} />
        <Key zoom={zoom} code={13} layoutInfo={l.N5} keyAction={click} />
        <Key zoom={zoom} code={5} layoutInfo={l.N6} keyAction={click} />
        <Key zoom={zoom} code={1} layoutInfo={l.N7} keyAction={click} />
        <Key zoom={zoom} code={0} layoutInfo={l.N8} keyAction={click} />
        <Key zoom={zoom} code={24} layoutInfo={l.N9} keyAction={click} />
        <Key zoom={zoom} code={40} layoutInfo={l.N0} keyAction={click} />
        <Key zoom={zoom} code={31} layoutInfo={l.Minus} keyAction={click} />
        <Key zoom={zoom} code={23} layoutInfo={l.Equal} keyAction={click} />
        <Key zoom={zoom} code={15} layoutInfo={l.Backslash} keyAction={click} />
        <Key zoom={zoom} code={7} layoutInfo={l.Delete} keyAction={click} />
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
            />
            <Key zoom={zoom} code={44} layoutInfo={l.Q} keyAction={click} />
            <Key zoom={zoom} code={36} layoutInfo={l.W} keyAction={click} />
            <Key zoom={zoom} code={28} layoutInfo={l.E} keyAction={click} />
            <Key zoom={zoom} code={20} layoutInfo={l.R} keyAction={click} />
            <Key zoom={zoom} code={12} layoutInfo={l.T} keyAction={click} />
            <Key zoom={zoom} code={4} layoutInfo={l.Y} keyAction={click} />
            <Key zoom={zoom} code={9} layoutInfo={l.U} keyAction={click} />
            <Key zoom={zoom} code={8} layoutInfo={l.I} keyAction={click} />
            <Key zoom={zoom} code={16} layoutInfo={l.O} keyAction={click} />
            <Key zoom={zoom} code={32} layoutInfo={l.P} keyAction={click} />
            <Key
              zoom={zoom}
              code={47}
              layoutInfo={l.SBracketL}
              keyAction={click}
            />
            <Key
              zoom={zoom}
              code={39}
              layoutInfo={l.SBracketR}
              keyAction={click}
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
            />
            <Key zoom={zoom} code={43} layoutInfo={l.A} keyAction={click} />
            <Key zoom={zoom} code={35} layoutInfo={l.S} keyAction={click} />
            <Key zoom={zoom} code={27} layoutInfo={l.D} keyAction={click} />
            <Key zoom={zoom} code={19} layoutInfo={l.F} keyAction={click} />
            <Key zoom={zoom} code={11} layoutInfo={l.G} keyAction={click} />
            <Key zoom={zoom} code={3} layoutInfo={l.H} keyAction={click} />
            <Key zoom={zoom} code={17} layoutInfo={l.J} keyAction={click} />
            <Key zoom={zoom} code={25} layoutInfo={l.K} keyAction={click} />
            <Key zoom={zoom} code={41} layoutInfo={l.L} keyAction={click} />
            <Key
              zoom={zoom}
              code={49}
              layoutInfo={l.Semicolon}
              keyAction={click}
            />
            <Key zoom={zoom} code={48} layoutInfo={l.Quote} keyAction={click} />
            <Key zoom={zoom} code={56} layoutInfo={l.Pound} keyAction={click} />
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
        />
        <Key zoom={zoom} code={42} layoutInfo={l.Z} keyAction={click} />
        <Key zoom={zoom} code={34} layoutInfo={l.X} keyAction={click} />
        <Key zoom={zoom} code={26} layoutInfo={l.C} keyAction={click} />
        <Key zoom={zoom} code={18} layoutInfo={l.V} keyAction={click} />
        <Key zoom={zoom} code={10} layoutInfo={l.B} keyAction={click} />
        <Key zoom={zoom} code={2} layoutInfo={l.N} keyAction={click} />
        <Key zoom={zoom} code={33} layoutInfo={l.M} keyAction={click} />
        <Key zoom={zoom} code={50} layoutInfo={l.Comma} keyAction={click} />
        <Key zoom={zoom} code={58} layoutInfo={l.Period} keyAction={click} />
        <Key zoom={zoom} code={57} layoutInfo={l.Slash} keyAction={click} />
        <Key
          zoom={zoom}
          code={63}
          layoutInfo={l.ShiftR}
          keyAction={click}
          xwidth={160}
        />
        <Key
          zoom={zoom}
          code={14}
          layoutInfo={l.Up}
          keyAction={click}
          vshift={8}
          fontSize={60}
        />
      </Row>
      <Row height='auto' style={rowStyle}>
        <Key zoom={zoom} code={60} layoutInfo={l.Index} keyAction={click} />
        <Key zoom={zoom} code={51} layoutInfo={l.Menu} keyAction={click} />
        <Key zoom={zoom} code={55} layoutInfo={l.Help} keyAction={click} />
        <Key
          zoom={zoom}
          code={62}
          layoutInfo={l.Square}
          keyAction={click}
          vshift={8}
          fontSize={60}
        />
        <Key
          zoom={zoom}
          code={46}
          layoutInfo={l.Space}
          keyAction={click}
          xwidth={702}
        />
        <Key zoom={zoom} code={59} keyAction={click} top='CAPS' bottom='LOCK' />
        <Key
          zoom={zoom}
          code={38}
          layoutInfo={l.Left}
          keyAction={click}
          fontSize={60}
          vshift={8}
        />
        <Key
          zoom={zoom}
          code={30}
          layoutInfo={l.Right}
          keyAction={click}
          vshift={8}
          fontSize={60}
        />
        <Key
          zoom={zoom}
          code={22}
          layoutInfo={l.Down}
          keyAction={click}
          vshift={8}
          fontSize={60}
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
          machine.queueKeystroke(3, 2, e.code, undefined);
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

  function click (e: Z88ButtonClickArgs): void {
    // const vmEngineService = getVmEngineService();
    // if (!vmEngineService.hasEngine) {
    //   // --- No engine
    //   return;
    // }
    // const engine = vmEngineService.getEngine() as CambridgeZ88Core;
    // // --- Set status of the primary key
    // engine.setKeyStatus(e.code, e.down);
    // // --- Set status of the secondary key
    // switch (e.iconCount) {
    //   case 0:
    //   case 1:
    //     if (!e.isLeft) {
    //       engine.setKeyStatus(LEFT_SHIFT_KEY, e.down);
    //     }
    //     break;
    //   case 2:
    //     if (e.keyCategory === "symbol") {
    //       engine.setKeyStatus(e.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY, e.down);
    //     }
    //     break;
    //   case 3:
    //     if (e.keyCategory === "key" && !e.isLeft) {
    //       engine.setKeyStatus(LEFT_SHIFT_KEY, e.down);
    //     } else if (e.keyCategory === "symbol") {
    //       if (e.special === "dk") {
    //         engine.setKeyStatus(SQUARE_KEY, e.down);
    //       } else {
    //         engine.setKeyStatus(e.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY, e.down);
    //       }
    //     } else if (e.keyCategory === "secondSymbol" && e.isLeft) {
    //       engine.setKeyStatus(DIAMOND_KEY, e.down);
    //     }
    //     break;
    // }
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
