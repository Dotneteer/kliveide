export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  displayBounds: Rectangle;
};

export type Rectangle = {
  height: number;
  width: number;
  x: number;
  y: number;
};
