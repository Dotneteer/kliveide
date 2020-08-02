import * as express from "express";
import * as bodyParser from "body-parser";
import * as fs from "fs";
import * as ipc from "node-ipc";

import { mainProcessStore } from "../main/mainProcessStore";
import {
  emulatorSetTapeContenstAction,
  emulatorShowKeyboardAction,
  emulatorHideKeyboardAction,
  emulatorToggleKeyboardAction,
  emulatorShowShadowScreenAction,
  emulatorHideShadowScreenAction,
  emulatorToggleShadowScreenAction,
  emulatorShowBeamPositionAction,
  emulatorHideBeamPositionAction,
  emulatorToggleBeamPositionAction,
  emulatorEnableFastLoadAction,
  emulatorDisableFastLoadAction,
  emulatorToggleFastLoadAction,
} from "../shared/state/redux-emulator-state";
import { emulatorSetCommandAction } from "../shared/state/redux-emulator-command-state";
import { register } from "electron-localshortcut";
import { RegisterData } from "../shared/spectrum/api-data";

const NOTIFICATION_SERVER = "vsKliveExtension";
let configured = false;
let connected = false;

/**
 * Starts the web server that provides an API to manage the Klive emulator
 */
export function startApiServer() {
  const app = express();
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(bodyParser.raw());

  /**
   * This call can be used to check if Klive Emulator is running.
   */
  app.get("/hello", (_req, res) => {
    res.send("KliveEmu");
  });

  /**
   * Gets frame information
   */
  app.get("/frame-info", (_req, res) => {
    const emuState = mainProcessStore.getState().emulatorPanelState;
    res.json({
      startCount: emuState.startCount,
      frameCount: emuState.frameCount
    });
  })

  /**
   * Starts the ZX Spectrum virtual machine
   */
  app.post("/start", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("start")());
    res.sendStatus(204);
  });

  /**
   * Pauses the ZX Spectrum virtual machine
   */
  app.post("/pause", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("pause")());
    res.sendStatus(204);
  });

  /**
   * Stops the ZX Spectrum virtual machine
   */
  app.post("/stop", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("stop")());
    res.sendStatus(204);
  });

  /**
   * Restarts the ZX Spectrum virtual machine
   */
  app.post("/restart", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("restart")());
    res.sendStatus(204);
  });

  /**
   * Starts the ZX Spectrum virtual machine in debug mode
   */
  app.post("/start-debug", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("start-debug")());
    res.sendStatus(204);
  });

  /**
   * Executes the next Z80 statement in step-in mode
   */
  app.post("/step-into", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("step-into")());
    res.sendStatus(204);
  });

  /**
   * Executes the next Z80 statement in step-over mode
   */
  app.post("/step-over", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("step-over")());
    res.sendStatus(204);
  });

  /**
   * Executes the next Z80 statement in step-out mode
   */
  app.post("/step-out", (_req, res) => {
    mainProcessStore.dispatch(emulatorSetCommandAction("step-out")());
    res.sendStatus(204);
  });

  /**
   * Sets the specified file's contents as the tape information to load
   */
  app.post("/set-tape", async (_req, res) => {
    let success = false;
    try {
      const contents = fs.readFileSync(_req.body?.tapeFile);
      mainProcessStore.dispatch(emulatorSetTapeContenstAction(contents)());
      success = true;
    } catch (err) {}
    res.sendStatus(success ? 200 : 403);
  });

  /**
   * Instructs the emulator UI to display the keyboard panel
   */
  app.post("/show-keyboard", (_req, res) => {
    mainProcessStore.dispatch(emulatorShowKeyboardAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to hide the keyboard panel
   */
  app.post("/hide-keyboard", (_req, res) => {
    mainProcessStore.dispatch(emulatorHideKeyboardAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to toggle the visibility of the keyboard panel
   */
  app.post("/toggle-keyboard", (_req, res) => {
    mainProcessStore.dispatch(emulatorToggleKeyboardAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to display the shadow screen
   */
  app.post("/show-shadow-screen", (_req, res) => {
    mainProcessStore.dispatch(emulatorShowShadowScreenAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to hide the shadow screen
   */
  app.post("/hide-shadow-screen", (_req, res) => {
    mainProcessStore.dispatch(emulatorHideShadowScreenAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to toggle the visibility of the shadow screen
   */
  app.post("/toggle-shadow-screen", (_req, res) => {
    mainProcessStore.dispatch(emulatorToggleShadowScreenAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to display the beam position
   */
  app.post("/show-beam-position", (_req, res) => {
    mainProcessStore.dispatch(emulatorShowBeamPositionAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to hide the beam position
   */
  app.post("/hide-beam-position", (_req, res) => {
    mainProcessStore.dispatch(emulatorHideBeamPositionAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to toggle the visibility of the shadow screen
   */
  app.post("/toggle-beam-position", (_req, res) => {
    mainProcessStore.dispatch(emulatorToggleBeamPositionAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to turn on fast load
   */
  app.post("/fast-load-on", (_req, res) => {
    mainProcessStore.dispatch(emulatorEnableFastLoadAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to turn off fast load
   */
  app.post("/fast-load-off", (_req, res) => {
    mainProcessStore.dispatch(emulatorDisableFastLoadAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to toggle the fast load mode
   */
  app.post("/toggle-fast-load", (_req, res) => {
    mainProcessStore.dispatch(emulatorToggleFastLoadAction());
    res.sendStatus(204);
  });

  /**
   * Instructs the emulator UI to get the state of the ui
   * Response:
   *  Status: 200
   *  Body:
   *    keyboard: boolean
   *    shadowScreen: boolean
   *    beamPosition: boolean
   *    fastLoad: boolean
   */
  app.get("/ui-state", (req, res) => {
    // TODO: Implement this method
    res.sendStatus(200);
  });

  /**
   * Gets the current values of Z80 registers
   */
  app.get("/z80-regs", (_req, res) => {
    const s = mainProcessStore.getState().vmInfo;
    const regs = s?.registers ? s.registers : <RegisterData>{
      af: 0xffff,
      bc: 0xffff,
      de: 0xffff,
      hl: 0xffff,
      af_: 0xffff,
      bc_: 0xffff,
      de_: 0xffff,
      hl_: 0xffff,
      pc: 0xffff,
      sp: 0xffff,
      ix: 0xffff,
      iy: 0xffff,
      i: 0xff,
      r: 0xff,
      wz: 0xffff
    }
    res.json(regs);
  });

  /**
   * Gets diagnostics information about the ZX Spectrum machine
   * Response:
   *  Status: 200
   *  Body:
   *    frameCount: u32
   *    frameTact: u32
   *    tactsInFrame: u32
   *    im: u8
   *    iff1: boolean
   *    iff2: boolean
   *    halted: boolean
   *    delay: u32
   *    beamTact: u32
   *    pixelOp: string
   *    contDelay: u32
   */
  app.get("/spectrum-diag", (req, res) => {
    // TODO: Implement this method
    res.sendStatus(200);
  });

  /**
   * Gets current state of the ZX Spectrum virtual machine
   * Response:
   *  Status: 200
   *  Body:
   *    state: string
   */
  app.get("/vm-state", (req, res) => {
    // TODO: Implement this method
    res.sendStatus(200);
  });

  /**
   * Gets the contents of the specified 16K ROM page
   * Response:
   *  Status: 200
   *  Body:
   *    contents: string (base64)
   */
  app.get("/rom/:id", (req, res) => {
    // TODO: Implement this method
    res.sendStatus(200);
  });

  /**
   * Gets the contents of the specified 16K RAM page
   * Response:
   *  Status: 200
   *  Body:
   *    contents: string (base64)
   */
  app.get("/bank/:id", (req, res) => {
    // TODO: Implement this method
    res.sendStatus(200);
  });

  /**
   * Gets the contents of the specified 8K RAM page
   * Response:
   *  Status: 200
   *  Body:
   *    contents: string (base64)
   */
  app.get("/bank8/:id", (req, res) => {
    // TODO: Implement this method
    res.sendStatus(200);
  });

  /**
   * Gets the contents of the specified memory range
   * Response:
   *  Status: 200
   *  Body:
   *    contents: string (base64)
   */
  app.get("/mem/:from/:to", (req, res) => {
    // TODO: Implement this method
    res.sendStatus(200);
  });

  app.listen(3000, () => console.log("Server started..."));
}
