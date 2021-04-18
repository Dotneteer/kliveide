import * as React from "react";
import { Cz88KeyView } from "../machines/cz88/cz88-keys";
import { themeService } from "../themes/theme-service";
import { Z88ButtonClickArgs } from "./ui-core-types";

const NORMAL_WIDTH = 100;
const NORMAL_HEIGHT = 100;

interface Props {
  zoom: number;
  code: number;
  layoutInfo?: Cz88KeyView;
  iconCount?: number;
  top?: string;
  bottom?: string;
  xwidth?: number;
  xheight?: number;
  vshift?: number;
  fontSize?: number;
  isEnter?: boolean;
  keyAction?: (e: Z88ButtonClickArgs, down: boolean) => void;
}

interface State {
  mouseOverKey: boolean;
  mouseOverSymbol: boolean;
  mouseOverSecondSymbol: boolean;
}

/**
 * Represents the statusbar of the emulator
 */
export default class Cz88Key extends React.Component<Props, State> {
  // --- Number of icons on the key
  private _iconCount = 0;

  // --- Invariant display properties
  private _keyBackground = themeService.getProperty(
    "--key-cz88-background-color"
  );
  private _mainKeyColor = themeService.getProperty("--key-cz88-main-color");
  private _keyStrokeColor = themeService.getProperty("--key-cz88-stroke-color");
  private _symbolKeyColor = themeService.getProperty("--key-cz88-main-color");
  private _highlightKeyColor = themeService.getProperty(
    "--key-cz88-highlight-color"
  );

  constructor(props: Props) {
    super(props);
    this.state = {
      mouseOverKey: false,
      mouseOverSymbol: false,
      mouseOverSecondSymbol: false,
    };
  }

  render() {
    let main = "";
    let keyword = "";
    let symbol = "";
    let secondSymbol;
    if (this.props.layoutInfo) {
      keyword = this.props.layoutInfo.keyword;
      main = this.props.layoutInfo.key;
      symbol = this.props.layoutInfo.symbol;
      secondSymbol = this.props.layoutInfo.secondSymbol;
    }
    this._iconCount = 0;
    if (main) this._iconCount++;
    if (symbol) this._iconCount++;
    if (secondSymbol) this._iconCount++;

    const currentWidth = this.props.zoom * (this.props.xwidth || NORMAL_WIDTH);
    const currentHeight =
      this.props.zoom * (this.props.xheight || NORMAL_HEIGHT);
    const mainFillColor = this.state.mouseOverKey
      ? this._highlightKeyColor
      : this._mainKeyColor;
    const mainStrokeColor = this.state.mouseOverKey
      ? this._highlightKeyColor
      : "transparent";
    const symbolFillColor = this.state.mouseOverSymbol
      ? this._highlightKeyColor
      : this._symbolKeyColor;
    const symbolStrokeColor = this.state.mouseOverSymbol
      ? this._highlightKeyColor
      : "transparent";
    const secondSymbolFillColor = this.state.mouseOverSecondSymbol
      ? this._highlightKeyColor
      : this._symbolKeyColor;
    const secondSymbolStrokeColor = this.state.mouseOverSecondSymbol
      ? this._highlightKeyColor
      : "transparent";
    const cursor =
      this.state.mouseOverKey || this.state.mouseOverSymbol
        ? "pointer"
        : "default";

    return (
      <svg
        width={currentWidth}
        height={currentHeight}
        viewBox={`0 0 ${(this.props.xwidth || NORMAL_WIDTH) + 20} ${
          (this.props.xheight || NORMAL_HEIGHT) + 20
        }`}
        style={{ margin: 0 }}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="2"
          y="2"
          rx="12"
          ry="12"
          width={this.props.xwidth || NORMAL_WIDTH}
          height={this.props.xheight || NORMAL_HEIGHT}
          fill={this._keyBackground}
          stroke={this._keyStrokeColor}
          strokeWidth="4"
          cursor={cursor}
          onMouseEnter={() => this.setState({ mouseOverKey: true })}
          onMouseLeave={() => this.setState({ mouseOverKey: false })}
          onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
        />
        {main && (
          <text
            x="14"
            y="88"
            fontSize="36"
            textAnchor="left"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            {main}
          </text>
        )}
        {symbol && (
          <rect
            x="48"
            y="16"
            width={54}
            height={40}
            fill="transparent"
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverSymbol: true })}
            onMouseLeave={() => this.setState({ mouseOverSymbol: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "symbol", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "symbol", false)}
          >
            {symbol}
          </rect>
        )}
        {symbol && (
          <text
            x="68"
            y="36"
            fontSize={32}
            textAnchor="middle"
            fill={symbolFillColor}
            stroke={symbolStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverSymbol: true })}
            onMouseLeave={() => this.setState({ mouseOverSymbol: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "symbol", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "symbol", false)}
          >
            {symbol}
          </text>
        )}
        {secondSymbol && (
          <rect
            x="48"
            y="68"
            width={54}
            height={40}
            fill="transparent"
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverSecondSymbol: true })}
            onMouseLeave={() => this.setState({ mouseOverSecondSymbol: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "secondsymbol", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "secondsymbol", false)}
          ></rect>
        )}
        {secondSymbol && (
          <text
            x="68"
            y="88"
            fontSize={32}
            textAnchor="middle"
            fill={secondSymbolFillColor}
            stroke={secondSymbolStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverSecondSymbol: true })}
            onMouseLeave={() => this.setState({ mouseOverSecondSymbol: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "secondsymbol", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "secondsymbol", false)}
          >
            {secondSymbol}
          </text>
        )}
        {keyword && (
          <text
            x={(this.props.xwidth || 100) / 2}
            y={62 + (this.props.vshift || 0)}
            fontSize={this.props.fontSize ?? 28}
            textAnchor="middle"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            {keyword}
          </text>
        )}
        {this.props.top && (
          <text
            x={(this.props.xwidth || 100) / 2}
            y={48}
            fontSize="28"
            textAnchor="middle"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            {top}
          </text>
        )}
        {this.props.bottom && (
          <text
            x={(this.props.xwidth || 100) / 2}
            y={76}
            fontSize="28"
            textAnchor="middle"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            {this.props.bottom}
          </text>
        )}
        {this.props.isEnter && (
          <text
            x={(this.props.xwidth || 100) / 2 - 6}
            y={54}
            fontSize="28"
            textAnchor="left"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            E
          </text>
        )}
        {this.props.isEnter && (
          <text
            x={(this.props.xwidth || 100) / 2 - 6}
            y={84}
            fontSize="28"
            textAnchor="left"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            N
          </text>
        )}
        {this.props.isEnter && (
          <text
            x={(this.props.xwidth || 100) / 2 - 6}
            y={114}
            font-size="28"
            text-anchor="left"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            T
          </text>
        )}
        {this.props.isEnter && (
          <text
            x={(this.props.xwidth || 100) / 2 - 6}
            y={144}
            font-size="28"
            text-anchor="left"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            E
          </text>
        )}
        {this.props.isEnter && (
          <text
            x={(this.props.xwidth || 100) / 2 - 6}
            y={174}
            font-size="28"
            text-anchor="left"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            R
          </text>
        )}
      </svg>
    );
  }

  private raiseKeyAction(
    e: React.MouseEvent,
    keyCategory: string,
    down: boolean
  ) {
    this.props.keyAction?.(
      {
        code: this.props.code,
        keyCategory,
        down,
        isLeft: e.button === 0,
        iconCount: this._iconCount,
        special: this.props.layoutInfo
          ? this.props.layoutInfo.special
          : undefined,
      },
      down
    );
  }
}
