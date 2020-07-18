import * as Koa from "koa";
import * as KoaRouter from "koa-router";

/**
 * Starts the koa server that listens in the background
 */
export function startKoaServer() {
  const app = new Koa();
  const router = new KoaRouter();

  app.use(router.routes()).use(router.allowedMethods());
  app.use(async (ctx) => (ctx.body = "Hello World"));
  app.listen(3000, () => console.log("Server started..."));
}
