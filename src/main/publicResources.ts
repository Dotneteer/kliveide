import { app } from "electron";
import path from "node:path";

export function getMainPublicPath(...segments: string[]): string {
  const publicRoot =
    process.env.ELECTRON_RENDERER_URL && !app.isPackaged
      ? path.join(process.cwd(), "src/public")
      : path.join(__dirname, "../public");

  return path.join(publicRoot, ...segments);
}
