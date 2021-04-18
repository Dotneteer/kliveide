import * as React from "react";
import { themeService } from "../themes/theme-service";
import { Sp48ButtonClickArgs } from "./ui-core-types";

const NORMAL_WIDTH = 100;

interface Props {
  zoom: number;
  code: number;
  main?: string;
  keyword?: string;
  symbol?: string;
  symbolWord?: string;
  above?: string;
  below?: string;
  center?: string;
  top?: string;
  bottom?: string;
  topNum?: string;
  topNumColor?: string;
  glyph?: number;
  useSymColor?: boolean;
  xwidth?: number;
  keyAction?: (e: Sp48ButtonClickArgs) => void;
}

interface State {
  mouseOverKey: boolean;
  mouseOverSymbol: boolean;
  mouseOverAbove: boolean;
  mouseOverBelow: boolean;
  mouseOverTopNum: boolean;
  mouseOverGlyph: boolean;
}

/**
 * Represents the statusbar of the emulator
 */
export default class Sp48Key extends React.Component<Props, State> {
  // --- Invariant display properties
  private _keyBackground = themeService.getProperty("--key-background-color");
  private _mainKeyColor = themeService.getProperty("--key-main-color");
  private _symbolKeyColor = themeService.getProperty("--key-symbol-color");
  private _aboveKeyColor = themeService.getProperty("--key-above-color");
  private _belowKeyColor = themeService.getProperty("--key-below-color");
  private _highlightKeyColor = themeService.getProperty(
    "--key-highlight-color"
  );

  constructor(props: Props) {
    super(props);
    this.state = {
      mouseOverKey: false,
      mouseOverSymbol: false,
      mouseOverAbove: false,
      mouseOverBelow: false,
      mouseOverTopNum: false,
      mouseOverGlyph: false,
    };
  }

  render() {
    const normalHeight = this.props.topNum ? 148 : 128;
    const heightOffset = this.props.topNum ? 20 : 0;
    const currentWidth = this.props.zoom * (this.props.xwidth || NORMAL_WIDTH);
    const currentHeight = this.props.zoom * normalHeight;
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
    const aboveFillColor = this.state.mouseOverAbove
      ? this._highlightKeyColor
      : this.props.topNum
      ? this._mainKeyColor
      : this._aboveKeyColor;
    const aboveStrokeColor = this.state.mouseOverAbove
      ? this._highlightKeyColor
      : "transparent";
    const belowFillColor = this.state.mouseOverBelow
      ? this._highlightKeyColor
      : this._belowKeyColor;
    const belowStrokeColor = this.state.mouseOverBelow
      ? this._highlightKeyColor
      : "transparent";
    const topNumFillColor = this.state.mouseOverTopNum
      ? this._highlightKeyColor
      : this.props.topNumColor || this._mainKeyColor;
    const topNumStrokeColor = this.state.mouseOverTopNum
      ? this._highlightKeyColor
      : "transparent";
    const glyphFillColor = this.state.mouseOverGlyph
      ? this._highlightKeyColor
      : this._mainKeyColor;
    const cursor =
      this.state.mouseOverKey ||
      this.state.mouseOverSymbol ||
      this.state.mouseOverAbove ||
      this.state.mouseOverBelow ||
      this.state.mouseOverTopNum
        ? "pointer"
        : "default";

    return (
      <svg
        width={currentWidth}
        height={currentHeight}
        viewBox={`0 0 ${this.props.xwidth || NORMAL_WIDTH} ${normalHeight}`}
        style={{ marginRight: "4px" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="0"
          y={30 + heightOffset}
          rx="8"
          ry="8"
          width="100%"
          height="70"
          fill={this._keyBackground}
          cursor={cursor}
          onMouseEnter={() => this.setState({ mouseOverKey: true })}
          onMouseLeave={() => this.setState({ mouseOverKey: false })}
          onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
          onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
        />
        {this.props.main && (
          <text
            x="12"
            y={70 + heightOffset}
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
            {this.props.main}
          </text>
        )}
        {this.props.keyword && (
          <text
            x="88"
            y={92 + heightOffset}
            fontSize="22"
            textAnchor="end"
            fill={mainFillColor}
            stroke={mainStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            {this.props.keyword}
          </text>
        )}
        {this.props.symbol ||
          (this.props.symbolWord && (
            <rect
              x={this.props.topNum ? 36 : 44}
              y={(this.props.topNum ? 70 : 34) + heightOffset}
              width={this.props.topNum ? 58 : 54}
              height={this.props.topNum ? 28 : 40}
              fill="transparent"
              cursor={cursor}
              onMouseEnter={() => this.setState({ mouseOverKey: true })}
              onMouseLeave={() => this.setState({ mouseOverKey: false })}
              onMouseDown={(e) => this.raiseKeyAction(e, "symbol", true)}
              onMouseUp={(e) => this.raiseKeyAction(e, "symbol", false)}
            >
              {this.props.symbol}
            </rect>
          ))}
        {this.props.symbol && (
          <text
            x="64"
            y={(this.props.topNum ? 90 : 64) + heightOffset}
            fontSize={this.props.topNum ? 24 : 28}
            textAnchor="middle"
            fill={symbolFillColor}
            stroke={symbolStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverSymbol: true })}
            onMouseLeave={() => this.setState({ mouseOverSymbol: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "symbol", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "symbol", false)}
          >
            {this.props.symbol}
          </text>
        )}
        {this.props.symbolWord && (
          <text
            x="92"
            y={58 + heightOffset}
            fontSize="18"
            textAnchor="end"
            fill={symbolFillColor}
            stroke={symbolStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverSymbol: true })}
            onMouseLeave={() => this.setState({ mouseOverSymbol: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "symbol", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "symbol", false)}
          >
            {this.props.symbolWord}
          </text>
        )}
        {this.props.above && (
          <text
            x="0"
            y={20 + heightOffset}
            fontSize="20"
            textAnchor="start"
            fill={aboveFillColor}
            stroke={aboveStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverSymbol: true })}
            onMouseLeave={() => this.setState({ mouseOverSymbol: false })}
            onMouseDown={(e) =>
              this.raiseKeyAction(
                e,
                this.props.topNum ? "topNum" : "above",
                true
              )
            }
            onMouseUp={(e) =>
              this.raiseKeyAction(
                e,
                this.props.topNum ? "topNum" : "above",
                false
              )
            }
          >
            {this.props.above}
          </text>
        )}
        {this.props.below && (
          <text
            x="0"
            y={124 + heightOffset}
            fontSize="20"
            textAnchor="start"
            fill={belowFillColor}
            stroke={belowStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverBelow: true })}
            onMouseLeave={() => this.setState({ mouseOverBelow: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "below", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "below", false)}
          >
            {this.props.below}
          </text>
        )}
        {this.props.center && (
          <text
            x={(this.props.xwidth || 100) / 2}
            y={(this.props.top ? 86 : 74) + heightOffset}
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
            {this.props.center}
          </text>
        )}
        {this.props.top && (
          <text
            x={(this.props.xwidth || 100) / 2}
            y={62 + heightOffset}
            fontSize="20"
            textAnchor="middle"
            fill={
              this.props.useSymColor
                ? this.state.mouseOverKey
                  ? this._highlightKeyColor
                  : symbolFillColor
                : mainFillColor
            }
            stroke={
              this.props.useSymColor
                ? this.state.mouseOverKey
                  ? this._highlightKeyColor
                  : symbolStrokeColor
                : mainStrokeColor
            }
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            {this.props.top}
          </text>
        )}
        {this.props.bottom && (
          <text
            x={(this.props.xwidth || 100) / 2}
            y={84 + heightOffset}
            fontSize="20"
            textAnchor="middle"
            fill={
              this.props.useSymColor
                ? this.state.mouseOverKey
                  ? this._highlightKeyColor
                  : symbolFillColor
                : mainFillColor
            }
            stroke={
              this.props.useSymColor
                ? this.state.mouseOverKey
                  ? this._highlightKeyColor
                  : symbolStrokeColor
                : mainStrokeColor
            }
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverKey: true })}
            onMouseLeave={() => this.setState({ mouseOverKey: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "main", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "main", false)}
          >
            {this.props.bottom}
          </text>
        )}
        {this.props.topNum && (
          <text
            x="0"
            y="18"
            fontSize="20"
            textAnchor="start"
            fill={topNumFillColor}
            stroke={topNumStrokeColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverTopNum: true })}
            onMouseLeave={() => this.setState({ mouseOverTopNum: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "above", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "above", false)}
          >
            {this.props.topNum}
          </text>
        )}
        {this.props.glyph && (
          <rect
            x="50"
            y="62"
            width="24"
            height="24"
            strokeWidth="3"
            stroke={glyphFillColor}
            fill={glyphFillColor}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverGlyph: true })}
            onMouseLeave={() => this.setState({ mouseOverGlyph: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "glyph", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "glyph", false)}
          />
        )}
        {this.props.glyph && this.props.glyph & 0x01 && (
          <rect
            x="61"
            y="62"
            width="12"
            height="12"
            fill={this._keyBackground}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverGlyph: true })}
            onMouseLeave={() => this.setState({ mouseOverGlyph: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "glyph", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "glyph", false)}
          />
        )}
        {this.props.glyph && this.props.glyph & 0x02 && (
          <rect
            x="50"
            y="62"
            width="12"
            height="12"
            fill={this._keyBackground}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverGlyph: true })}
            onMouseLeave={() => this.setState({ mouseOverGlyph: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "glyph", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "glyph", false)}
          />
        )}
        {this.props.glyph && this.props.glyph & 0x04 && (
          <rect
            x="61"
            y="73"
            width="12"
            height="12"
            fill={this._keyBackground}
            cursor={cursor}
            onMouseEnter={() => this.setState({ mouseOverGlyph: true })}
            onMouseLeave={() => this.setState({ mouseOverGlyph: false })}
            onMouseDown={(e) => this.raiseKeyAction(e, "glyph", true)}
            onMouseUp={(e) => this.raiseKeyAction(e, "glyph", false)}
          />
        )}
      </svg>
    );
  }

  private raiseKeyAction(
    e: React.MouseEvent,
    keyCategory: string,
    down: boolean
  ) {
    this.props.keyAction?.({
      code: this.props.code,
      keyCategory,
      button: e.button,
      down,
    });
  }
}
