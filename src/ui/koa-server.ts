import * as Koa from "koa";
import * as KoaRouter from "koa-router";
import { mainProcessStore } from "../../src/main/mainProcessStore";
import { z80MemoryContents } from "../../src/main/mainMessageProcessor";

/**
 * Starts the koa server that listens in the background
 */
export function startKoaServer() {
  const app = new Koa();
  const router = new KoaRouter();

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
    ctx.body = z80MemoryContents;
  });


  app.use(router.routes()).use(router.allowedMethods());
  app.use(async (ctx) => (ctx.body = "Hello World"));
  app.listen(3000, () => console.log("Server started..."));
}
