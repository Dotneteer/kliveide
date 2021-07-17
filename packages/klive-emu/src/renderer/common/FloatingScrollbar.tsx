import * as React from "react";
import { CSSProperties } from "react";

const MIN_HANDLE_SIZE = 20;

type Orientation = "vertical" | "horizontal";

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

export type ScrollBarApi = {
  signHostDimension: (dims: ScrollBarData) => void;
};

type Props = {
  direction: Orientation;
  barSize: number;
  forceShow: boolean;
  registerApi: (api: ScrollBarApi) => void;
  sizing?: (isSizing: boolean) => void;
  moved?: (newPosition: number) => void;
};

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
  dragging: boolean;
};

export default class FloatingScrollbar
  extends React.Component<Props, State>
  implements ScrollBarApi
{
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
      dragging: false,
    };
  }

  componentDidMount() {
    this.props.registerApi(this);
  }

  signHostDimension(dims: ScrollBarData) {
    // --- Calculate handle dimensions
    console.log("Api called");
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
      opacity: this.state.dragging ? 1.0 : this.props.forceShow ? 0.8 : 0.0,
      transitionProperty: "opacity",
      transitionDuration: this.state.dragging ? "0s" : "0.5s",
      transitionDelay: this.state.dragging ? "0s" : "0.25s",
    };

    return (
      <div style={barStyle}>
        <div style={handleStyle}></div>
      </div>
    );
  }
}

// export function FloatingScrollbarOld({
//   direction,
//   barSize = 10,
//   hostLeft,
//   hostTop,
//   hostSize,
//   hostCrossSize,
//   hostScrollSize,
//   hostScrollPos,
//   forceShow,
//   registerApi,
//   sizing,
//   moved,
// }: ScrollBarProps) {
//   // --- We need a context that uses "this" function when handles the `move`
//   // --- function to respond to document events
//   const context: DragContext = {
//     gripPosition: 0,
//     move: (e: MouseEvent) => move(e, context),
//     resized: (newPosition, newHandlePosition) => {
//       moved?.(newPosition);
//       //setHandlePos(newHandlePosition);
//     },
//     endDragging: () => {
//       setDragging(false);
//       sizing?.(false);
//     },
//   };

//   const show = hostScrollSize > hostSize;
//   const handleSize =
//     show &&
//     Math.max(
//       hostScrollSize > 0 ? (hostSize * hostSize) / hostScrollSize : 0,
//       MIN_HANDLE_SIZE
//     );
//   var initialPos =
//     show && hostScrollSize > 0
//       ? (hostScrollPos * hostSize) / (hostScrollSize - hostSize)
//       : 0;
//   if (initialPos + handleSize > hostSize) {
//     initialPos = hostSize - handleSize;
//   }

//   console.log("bar", hostScrollPos);
//   const [dragging, setDragging] = useState(false);

//   const barStyle: CSSProperties = {
//     position: "absolute",
//     top:
//       direction === "horizontal"
//         ? hostTop + hostCrossSize - barSize
//         : undefined,
//     left:
//       direction === "vertical" ? hostLeft + hostCrossSize - barSize : undefined,
//     width: direction === "horizontal" ? hostSize : barSize,
//     height: direction === "vertical" ? hostSize : barSize,
//     background: "transparent",
//   };

//   let currentPos = initialPos;
//   if (currentPos + handleSize > hostSize) {
//     currentPos = hostSize - handleSize;
//   }

//   const handleStyle: CSSProperties = {
//     position: "absolute",
//     top: direction === "horizontal" ? undefined : currentPos,
//     left: direction === "vertical" ? undefined : currentPos,
//     width: direction === "horizontal" ? handleSize : barSize,
//     height: direction === "vertical" ? handleSize : barSize,
//     background: "var(--scrollbar-background-color)",
//     opacity: show && (dragging ? 1.0 : forceShow ? 0.8 : 0.0),
//     transitionProperty: "opacity",
//     transitionDuration: dragging ? "0s" : "0.5s",
//     transitionDelay: dragging ? "0s" : "0.25s",
//   };

//   registerApi?.((delta) => moveDelta(delta, context));

//   /**
//    * Starts resizing this panel
//    */
//   function startResize(e: React.MouseEvent): void {
//     context.gripPosition = direction === "horizontal" ? e.clientX : e.clientY;
//     window.addEventListener("mouseup", endResize);
//     window.addEventListener("touchend", endResize);
//     window.addEventListener("touchcancel", endResize);
//     window.addEventListener("mousemove", context.move);
//     window.addEventListener("touchmove", context.move);
//   }

//   /**
//    * Ends resizing this panel
//    */
//   function endResize(): void {
//     window.removeEventListener("mouseup", endResize);
//     window.removeEventListener("touchend", endResize);
//     window.removeEventListener("touchcancel", endResize);
//     window.removeEventListener("mousemove", context.move);
//     window.removeEventListener("touchmove", context.move);
//     context.endDragging();
//   }

//   /**
//    * Change the size of the element
//    */
//   function move(e: MouseEvent, context: DragContext): void {
//     const delta =
//       (direction === "horizontal" ? e.clientX : e.clientY) -
//       context.gripPosition;
//     moveDelta(delta, context);
//   }

//   /**
//    * Executes the delta movement
//    * @param delta Delta value
//    * @param context Movement context
//    */
//   function moveDelta(delta: number, context: DragContext): void {
//     const maxPosition = hostSize - handleSize;
//     var newPosition = Math.max(0, delta);
//     newPosition = Math.min(newPosition, maxPosition);
//     initialPos = newPosition;
//     var newScrollPosition =
//       (newPosition * (hostScrollSize - hostSize)) / maxPosition;
//     context.resized(newScrollPosition, newPosition);
//   }

//   return (
//     <div style={barStyle}>
//       {show && (
//         <div
//           style={handleStyle}
//           onMouseDown={(ev) => {
//             if (ev.button === 0) {
//               sizing?.(true);
//               startResize(ev);
//               setDragging(true);
//             }
//           }}
//           onMouseUp={() => {
//             endResize();
//             setDragging(false);
//             sizing?.(false);
//           }}
//         />
//       )}
//     </div>
//   );
// }

// // --- Context for the drag operation
// interface DragContext {
//   gripPosition: number;
//   move: (e: MouseEvent) => void;
//   resized: (newPosition: number, newHandlePos: number) => void;
//   endDragging: () => void;
// }
