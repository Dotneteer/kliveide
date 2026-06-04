import type { Rectangle } from "electron";

export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
  displayBounds: Rectangle;
};
