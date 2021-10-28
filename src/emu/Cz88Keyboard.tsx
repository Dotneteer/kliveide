import * as React from "react";
import styles from "styled-components";

import { Cz88KeyboardLayout } from "@modules/vm-z88/cz88-keys";
import { esZ88KeyboardLayout } from "@modules/vm-z88/key-layout-es";
import { frZ88KeyboardLayout } from "@modules/vm-z88/key-layout-fr";
import { deZ88KeyboardLayout } from "@modules/vm-z88/key-layout-de";
import { dkZ88KeyboardLayout } from "@modules/vm-z88/key-layout-dk";
import { seZ88KeyboardLayout } from "@modules/vm-z88/key-layout-se";
import { defaultZ88KeyboardLayout } from "@modules/vm-z88/key-layout-default";
import { getVmEngineService } from "@modules-core/vm-engine-service";
import { CambridgeZ88Core } from "@modules/vm-z88/CambridgeZ88Core";
import { Z88ButtonClickArgs } from "./ui-core-types";
import Key from "./Cz88Key";

const DEFAULT_WIDTH = 15 * 108 + 200 + 48;
const DEFAULT_HEIGHT = 5 * (100 + 8) + 48;

// --- Special key codes
const LEFT_SHIFT_KEY = 54;
const SQUARE_KEY = 62;
const DIAMOND_KEY = 52;

/**
 * Component properties
 */
interface Props {
  width: number;
  height: number;
  layout?: string;
}

/**
 * Represents the keyboard of Czmbridge Z88
 */
export default function Cz88Keyboard(props: Props) {
  // --- Prepare keyboard layout information
  let l: Cz88KeyboardLayout;
  switch (props.layout) {
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
  const zoom = calculateZoom(props.width, props.height);

  return (
    <Root>
      <KeyRow>
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
      </KeyRow>
      <KeyRow2To3>
        <div style={{ margin: 0 }}>
          <KeyRow>
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
          </KeyRow>
          <KeyRow>
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
          </KeyRow>
        </div>
        <EnterContainer>
          <Key
            zoom={zoom}
            code={6}
            keyAction={click}
            isEnter={true}
            xwidth={122}
            xheight={200}
          />
        </EnterContainer>
      </KeyRow2To3>
      <KeyRow>
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
      </KeyRow>
      <KeyRow>
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
        <Key zoom={zoom} code={59} keyAction={click} top="CAPS" bottom="LOCK" />
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
      </KeyRow>
    </Root>
  );

  function click(e: Z88ButtonClickArgs): void {
    const vmEngineService = getVmEngineService();
    if (!vmEngineService.hasEngine) {
      // --- No engine
      return;
    }
    const engine = vmEngineService.getEngine() as CambridgeZ88Core

    // --- Set status of the primary key
    engine.setKeyStatus(e.code, e.down);

    // --- Set status of the secondary key
    switch (e.iconCount) {
      case 0:
      case 1:
        if (!e.isLeft) {
          engine.setKeyStatus(LEFT_SHIFT_KEY, e.down);
        }
        break;
      case 2:
        if (e.keyCategory === "symbol") {
          engine.setKeyStatus(e.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY, e.down);
        }
        break;
      case 3:
        if (e.keyCategory === "key" && !e.isLeft) {
          engine.setKeyStatus(LEFT_SHIFT_KEY, e.down);
        } else if (e.keyCategory === "symbol") {
          if (e.special === "dk") {
            engine.setKeyStatus(SQUARE_KEY, e.down);
          } else {
            engine.setKeyStatus(e.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY, e.down);
          }
        } else if (e.keyCategory === "secondSymbol" && e.isLeft) {
          engine.setKeyStatus(DIAMOND_KEY, e.down);
        }
        break;
    }
  }

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
  font-weight: bold;
`;

const KeyRow2To3 = styles.div`
  display: flex;
  flex-direction: row;
  flex-grow: 0;
  flex-shrink: 0;
  margin: 0;
`;

const EnterContainer = styles.div`
  display: flex;
  flex-grow: 0;
  flex-shrink: 0;
  font-weight: bold;
  margin: 0;
`;
