import * as Koa from "koa";
import * as KoaRouter from "koa-router";
import { mainProcessStore } from "../main/mainProcessStore";
import { z80MemoryContents } from "../main/mainMessageProcessor";
import { emulatorSetBreakpointAction } from "../shared/state/redux-emulator-state"

/**
 * Starts the koa server that listens in the background
 */
export function startKoaServer() {
  const app = new Koa();
  const router = new KoaRouter();

  router.get("hello", "/hello", (ctx) => {
    ctx.body = "KliveEmu";
    ctx.status = 200
  });


  router.get("settape", "/settape", (ctx) => {
    ctx.body = "Tape set.";
  });

  router.get("emustate", "/emustate", (ctx) => {
    const state = mainProcessStore.getState();
    if (state.emulatorPanelState && state.emulatorPanelState.executionState) {
      ctx.body = state.emulatorPanelState;
    } else {
      ctx.body = "none";
    }
  });

  router.get("dumpmem", "/dumpmem", (ctx) => {
    ctx.body = z80MemoryContents;
  });

  router.get("br", "/br/:id", (ctx) => {
    try {
      const id = parseInt(ctx.params.id, 16);
      mainProcessStore.dispatch(emulatorSetBreakpointAction(id)());
      const state = mainProcessStore.getState().emulatorPanelState;
      ctx.body = `0x${state.breakPoint.toString(16)}`;
    } catch (err) {
      ctx.body = err.toString();
    }
  });


  app.use(router.routes()).use(router.allowedMethods());
  app.use(async (ctx) => (ctx.body = "Hello World"));
  app.listen(3000, () => console.log("Server started..."));
}
