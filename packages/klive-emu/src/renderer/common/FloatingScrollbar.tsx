import * as React from "react";
import { CSSProperties } from "react";

/**
 * The minimum size of the scrollbar's handle
 */
const MIN_HANDLE_SIZE = 20;

/**
 * The orientation of the scrollbar element
 */
export type ElementOrientation = "vertical" | "horizontal";

/**
 * Represents the data of the scrollbar
 */
export type ScrollBarData = {
  barSize?: number;
  hostLeft: number;
  hostTop: number;
  hostSize: number;
  hostCrossSize: number;
  hostScrollSize: number;
  hostScrollPos: number;
};

/**
 * Represents the API of the scrollbar
 */
export type ScrollbarApi = {
  signHostDimension: (dims: ScrollBarData) => void;
};

/**
 * Scrollbar properties
 */
type Props = {
  direction: ElementOrientation;
  barSize: number;
  forceShow: boolean;
  registerApi?: (api: ScrollbarApi) => void;
  sizing?: (isSizing: boolean) => void;
  moved?: (newPosition: number) => void;
};

/**
 * Scrollbar state
 */
type State = {
  barTop: number;
  barLeft: number;
  barWidth: number;
  barHeight: number;
  handleTop: number;
  handleLeft: number;
  handleWidth: number;
  handleHeight: number;
  show: boolean;
  pointed: boolean;
  dragging: boolean;
  refreshCount: number;
};

/**
 * This control represents a scrollbar that is visible when the scroll container has the focus.
 *
 * Initially, the scrollbar is invisible. When its parent container passes the parent
 * dimensions through the ScrollbarApi, the control creates a handle that represents the
 * current position of the scrollbar
 */
export default class FloatingScrollbar
  extends React.Component<Props, State>
  implements ScrollbarApi
{
  private _gripPosition: number;
  private _startPosition: number;
  private _move: Function;
  private _endResize: Function;
  private _dims: ScrollBarData;

  /**
   *
   * @param props Component properties
   */
  constructor(props: Props) {
    super(props);
    this.state = {
      barTop: 0,
      barLeft: 0,
      barWidth: 0,
      barHeight: 0,
      handleTop: 0,
      handleLeft: 0,
      handleWidth: 0,
      handleHeight: 0,
      show: false,
      pointed: false,
      dragging: false,
      refreshCount: 0,
    };
    this._move = this.move.bind(this);
    this._endResize = this.endResize.bind(this);
  }

  /**
   * Allow the parent component to call the scrollbar's API
   */
  componentDidMount() {
    this.props.registerApi?.(this);
  }

  /**
   * The parent calls this method whenewer its dimensions or the scrollbar's
   * position changes.
   * @param dims New host/scrollbar dimensions
   */
  signHostDimension(dims: ScrollBarData) {
    this._dims = dims;

    // --- Calculate handle dimensions
    const { direction, barSize } = this.props;

    const show = dims.hostScrollSize > dims.hostSize;
    const handleSize =
      show &&
      Math.max(
        dims.hostScrollSize > 0
          ? (dims.hostSize * dims.hostSize) / dims.hostScrollSize
          : 0,
        MIN_HANDLE_SIZE
      );
    let initialPos =
      show && dims.hostScrollSize > 0
        ? (dims.hostScrollPos * (dims.hostSize - handleSize)) /
          (dims.hostScrollSize - dims.hostSize)
        : 0;
    if (initialPos + handleSize > dims.hostSize) {
      initialPos = dims.hostSize - handleSize;
    }

    // --- Set bar and handles dimensions
    this.setState({
      show,
      barTop:
        direction === "horizontal"
          ? dims.hostTop + dims.hostCrossSize - barSize
          : undefined,
      barLeft:
        direction === "vertical"
          ? dims.hostLeft + dims.hostCrossSize - barSize
          : undefined,
      barWidth: direction === "horizontal" ? dims.hostSize : barSize,
      barHeight: direction === "vertical" ? dims.hostSize : barSize,
      handleTop: direction === "horizontal" ? undefined : initialPos,
      handleLeft: direction === "vertical" ? undefined : initialPos,
      handleWidth: direction === "horizontal" ? handleSize : barSize,
      handleHeight: direction === "vertical" ? handleSize : barSize,
    });
  }

  render() {
    const barStyle: CSSProperties = {
      position: "absolute",
      top: this.state.barTop,
      left: this.state.barLeft,
      width: this.state.barWidth,
      height: this.state.barHeight,
      background: "transparent",
    };

    const handleStyle: CSSProperties = {
      position: "absolute",
      top: this.state.handleTop,
      left: this.state.handleLeft,
      width: this.state.handleWidth,
      height: this.state.handleHeight,
      background: "var(--scrollbar-background-color)",
      opacity: this.state.dragging
        ? 1.0
        : this.state.pointed || this.props.forceShow
        ? 0.8
        : 0.0,
      transitionProperty: "opacity",
      transitionDuration: this.state.dragging ? "0s" : "0.5s",
      transitionDelay: this.state.dragging ? "0s" : "0.25s",
    };

    return this.state.show ? (
      <div
        style={barStyle}
        onMouseEnter={() => this.setState({ pointed: true })}
        onMouseLeave={() => this.setState({ pointed: false })}
      >
        <div
          style={handleStyle}
          onMouseDown={(ev) => {
            if (ev.button === 0) {
              this.props.sizing?.(true);
              this.startResize(ev);
              this.setState({ dragging: true });
            }
          }}
          onMouseUp={() => {
            this.endResize();
            this.setState({ dragging: false });
            this.props.sizing?.(false);
          }}
        ></div>
      </div>
    ) : null;
  }

  /**
   * Starts resizing this panel
   */
  startResize(e: React.MouseEvent): void {
    this._gripPosition =
      this.props.direction === "horizontal" ? e.clientX : e.clientY;
    this._startPosition =
      this.props.direction === "horizontal"
        ? this.state.handleLeft
        : this.state.handleTop;
    window.addEventListener("mouseup", this._endResize as any);
    window.addEventListener("touchend", this._endResize as any);
    window.addEventListener("touchcancel", this._endResize as any);
    window.addEventListener("mousemove", this._move as any);
    window.addEventListener("touchmove", this._move as any);
  }

  /**
   * Ends resizing this panel
   */
  endResize(): void {
    window.removeEventListener("mouseup", this._endResize as any);
    window.removeEventListener("touchend", this._endResize as any);
    window.removeEventListener("touchcancel", this._endResize as any);
    window.removeEventListener("mousemove", this._move as any);
    window.removeEventListener("touchmove", this._move as any);
    this.setState({ dragging: false });
    this.props.sizing?.(false);
  }

  /**
   * Change the size of the element
   */
  move(e: MouseEvent): void {
    const delta =
      (this.props.direction === "horizontal" ? e.clientX : e.clientY) -
      this._gripPosition;
    this.moveDelta(delta);
  }

  /**
   * Executes the delta movement
   * @param delta Delta value
   * @param context Movement context
   */
  moveDelta(delta: number): void {
    const maxPosition =
      this._dims.hostSize -
      (this.props.direction === "horizontal"
        ? this.state.handleWidth
        : this.state.handleHeight);
    var newPosition = Math.max(0, this._startPosition + delta);
    newPosition = Math.min(newPosition, maxPosition);
    var newScrollPosition =
      (newPosition * (this._dims.hostScrollSize - this._dims.hostSize)) /
      maxPosition;
    this.props.moved(newScrollPosition);
  }
}
