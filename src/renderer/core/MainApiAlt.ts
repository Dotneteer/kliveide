import { createMainAltApi } from "@common/messaging/MainApiAlt";
import { useRef } from "react";
import { useRendererContext } from "./RendererProvider";

export function useMainApiAlt() {
  const api = useRef<ReturnType<typeof createMainAltApi>>(null);
  const { messenger } = useRendererContext();
  if (api.current) {
    return api.current;
  }
  api.current = createMainAltApi(messenger);
  return api.current;
}
