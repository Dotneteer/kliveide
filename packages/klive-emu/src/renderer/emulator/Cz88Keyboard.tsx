import * as React from "react";
import { ZxSpectrumCoreBase } from "../machines/spectrum/ZxSpectrumCoreBase";
import { vmEngineService } from "../machines/vm-engine-service";
import { Z88ButtonClickArgs } from "./ui-core-types";
import Key from "./Cz88Key";
import { defaultZ88KeyboardLayout } from "../machines/cz88/key-layout-default";
import { esZ88KeyboardLayout } from "../machines/cz88/key-layout-es";
import { frZ88KeyboardLayout } from "../machines/cz88/key-layout-fr";
import { deZ88KeyboardLayout } from "../machines/cz88/key-layout-de";
import { dkZ88KeyboardLayout } from "../machines/cz88/key-layout-dk";
import { seZ88KeyboardLayout } from "../machines/cz88/key-layout-se";
import { Cz88KeyboardLayout } from "../machines/cz88/cz88-keys";

const DEFAULT_WIDTH = 15 * 108 + 200 + 48;
const DEFAULT_HEIGHT = 5 * (100 + 8) + 48;

// --- Special key codes
const LEFT_SHIFT_KEY = 54;
const SQUARE_KEY = 62;
const DIAMOND_KEY = 52;

interface Props {
  width: number;
  height: number;
  layout?: string;
}

/**
 * Represents the statusbar of the emulator
 */
export default class Cz88Keyboard extends React.Component<Props> {
  private _zoom = 0.05;

  constructor(props: Props) {
    super(props);
  }

  render() {
    // --- Prepare keyboard layout information
    let clo: Cz88KeyboardLayout;
    switch (this.props.layout) {
      case "es":
        clo = esZ88KeyboardLayout;
        break;
      case "fr":
        clo = frZ88KeyboardLayout;
        break;
      case "de":
        clo = deZ88KeyboardLayout;
        break;
      case "dk":
        clo = dkZ88KeyboardLayout;
        break;
      case "se":
        clo = seZ88KeyboardLayout;
        break;
      default:
        clo = defaultZ88KeyboardLayout;
        break;
    }

    this.calculateZoom(this.props.width, this.props.height);
    return (
      <div className="keyboard">
        <div className="key-row-z88">
          <Key
            zoom={this._zoom}
            code={61}
            layoutInfo={clo.Escape}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={45}
            layoutInfo={clo.N1}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={37}
            layoutInfo={clo.N2}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={29}
            layoutInfo={clo.N3}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={21}
            layoutInfo={clo.N4}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={13}
            layoutInfo={clo.N5}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={5}
            layoutInfo={clo.N6}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={1}
            layoutInfo={clo.N7}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={0}
            layoutInfo={clo.N8}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={24}
            layoutInfo={clo.N9}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={40}
            layoutInfo={clo.N0}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={31}
            layoutInfo={clo.Minus}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={23}
            layoutInfo={clo.Equal}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={15}
            layoutInfo={clo.Backslash}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={7}
            layoutInfo={clo.Delete}
            keyAction={this.handleClick}
          />
        </div>
        <div className="key-row-z88-2-3">
          <div style={{ margin: 0 }}>
            <div className="key-row-z88">
              <Key
                zoom={this._zoom}
                code={53}
                layoutInfo={clo.Tab}
                keyAction={this.handleClick}
                xwidth={140}
              />
              <Key
                zoom={this._zoom}
                code={44}
                layoutInfo={clo.Q}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={36}
                layoutInfo={clo.W}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={28}
                layoutInfo={clo.E}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={20}
                layoutInfo={clo.R}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={12}
                layoutInfo={clo.T}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={4}
                layoutInfo={clo.Y}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={9}
                layoutInfo={clo.U}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={8}
                layoutInfo={clo.I}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={16}
                layoutInfo={clo.O}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={32}
                layoutInfo={clo.P}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={47}
                layoutInfo={clo.SBracketL}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={39}
                layoutInfo={clo.SBracketR}
                keyAction={this.handleClick}
              />
            </div>
            <div className="key-row-z88">
              <Key
                zoom={this._zoom}
                code={52}
                layoutInfo={clo.Diamond}
                keyAction={this.handleClick}
                vshift={8}
                fontSize={60}
                xwidth={180}
              />
              <Key
                zoom={this._zoom}
                code={43}
                layoutInfo={clo.A}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={35}
                layoutInfo={clo.S}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={27}
                layoutInfo={clo.D}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={19}
                layoutInfo={clo.F}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={11}
                layoutInfo={clo.G}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={3}
                layoutInfo={clo.H}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={17}
                layoutInfo={clo.J}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={25}
                layoutInfo={clo.K}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={41}
                layoutInfo={clo.L}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={49}
                layoutInfo={clo.Semicolon}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={48}
                layoutInfo={clo.Quote}
                keyAction={this.handleClick}
              />
              <Key
                zoom={this._zoom}
                code={56}
                layoutInfo={clo.Pound}
                keyAction={this.handleClick}
              />
            </div>
          </div>
          <div className="enter-z88">
            <Key
              zoom={this._zoom}
              code={6}
              keyAction={this.handleClick}
              isEnter={true}
              xwidth={122}
              xheight={200}
            />
          </div>
        </div>
        <div className="key-row-z88">
          <Key
            zoom={this._zoom}
            code={54}
            layoutInfo={clo.ShiftL}
            keyAction={this.handleClick}
            xwidth={240}
          />
          <Key
            zoom={this._zoom}
            code={42}
            layoutInfo={clo.Z}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={34}
            layoutInfo={clo.X}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={26}
            layoutInfo={clo.C}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={18}
            layoutInfo={clo.V}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={10}
            layoutInfo={clo.B}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={2}
            layoutInfo={clo.N}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={33}
            layoutInfo={clo.M}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={50}
            layoutInfo={clo.Comma}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={58}
            layoutInfo={clo.Period}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={57}
            layoutInfo={clo.Slash}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={63}
            layoutInfo={clo.ShiftR}
            keyAction={this.handleClick}
            xwidth={160}
          />
          <Key
            zoom={this._zoom}
            code={14}
            layoutInfo={clo.Up}
            keyAction={this.handleClick}
            vshift={8}
            fontSize={60}
          />
        </div>
        <div className="key-row-z88">
          <Key
            zoom={this._zoom}
            code={60}
            layoutInfo={clo.Index}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={51}
            layoutInfo={clo.Menu}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={55}
            layoutInfo={clo.Help}
            keyAction={this.handleClick}
          />
          <Key
            zoom={this._zoom}
            code={62}
            layoutInfo={clo.Square}
            keyAction={this.handleClick}
            vshift={8}
            fontSize={60}
          />
          <Key
            zoom={this._zoom}
            code={46}
            layoutInfo={clo.Space}
            keyAction={this.handleClick}
            xwidth={702}
          />
          <Key
            zoom={this._zoom}
            code={59}
            keyAction={this.handleClick}
            top="CAPS"
            bottom="LOCK"
          />
          <Key
            zoom={this._zoom}
            code={38}
            layoutInfo={clo.Left}
            keyAction={this.handleClick}
            fontSize={60}
            vshift={8}
          />
          <Key
            zoom={this._zoom}
            code={30}
            layoutInfo={clo.Right}
            keyAction={this.handleClick}
            vshift={8}
            fontSize={60}
          />
          <Key
            zoom={this._zoom}
            code={22}
            layoutInfo={clo.Down}
            keyAction={this.handleClick}
            vshift={8}
            fontSize={60}
          />
        </div>
      </div>
    );
  }

  handleClick = (e: Z88ButtonClickArgs) => {
    if (!vmEngineService.hasEngine) {
      // --- No engine
      return;
    }
    const engine = vmEngineService.getEngine() as ZxSpectrumCoreBase;

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
  };

  calculateZoom(width: number, height: number): void {
    if (!width || !height) return;
    let widthRatio = (width - 24) / DEFAULT_WIDTH;
    let heightRatio = (height - 32) / DEFAULT_HEIGHT;
    this._zoom = Math.min(widthRatio, heightRatio);
  }
}
