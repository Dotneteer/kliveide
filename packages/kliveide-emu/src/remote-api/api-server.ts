import * as express from "express";
import * as bodyParser from "body-parser";
import * as fs from "fs";

import { mainProcessStore } from "../main/mainProcessStore";
import {
  emulatorSetTapeContenstAction,
  emulatorRequestTypeAction,
} from "../shared/state/redux-emulator-state";
import { RegisterData } from "../shared/machines/api-data";
import { breakpointSetAction } from "../shared/state/redux-breakpoint-state";
import { breakpointRemoveAction } from "../shared/state/redux-breakpoint-state";
import { checkTapeFile } from "../shared/tape/readers";
import { BinaryReader } from "../shared/utils/BinaryReader";
import { IdeConfiguration } from "../shared/state/AppState";
import { ideConfigSetAction } from "../shared/state/redux-ide-config-state";
import { appConfiguration } from "../main/klive-configuration";
import { ideConnectsAction } from "../shared/state/redux-ide-connection.state";
import { AppWindow } from "../main/AppWindow";
import { GetMachineStateMessage, GetMachineStateResponse, GetMemoryContentsResponse } from "../shared/messaging/message-types";

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
    const state = mainProcessStore.getState();
    res.send(
      state.emulatorPanelState.engineInitialized ? "KliveEmu" : "initializing"
    );
  });

  /**
   * Gets frame information
   */
  app.get("/frame-info", (_req, res) => {
    const state = mainProcessStore.getState();
    const emuState = state.emulatorPanelState;
    const vmInfo = state.vmInfo;
    res.json({
      startCount: emuState.startCount,
      frameCount: emuState.frameCount,
      executionState: emuState.executionState,
      breakpoints: Array.from(state.breakpoints),
      pc: vmInfo.registers?.pc ?? -1,
      runsInDebug: emuState.runsInDebug,
      machineType: emuState.currentType,
      selectedRom: emuState.selectedRom,
      selectedBank: emuState.selectedBank,
      internalState: emuState.internalState,
    });
    mainProcessStore.dispatch(ideConnectsAction());
  });

  /**
   * Sets the specified file's contents as the tape information to load
   */
  app.post("/tape-contents", async (_req, res) => {
    let success = false;
    try {
      const contents = fs.readFileSync(_req.body?.tapeFile);
      if (checkTapeFile(new BinaryReader(contents))) {
        mainProcessStore.dispatch(emulatorSetTapeContenstAction(contents)());
        success = true;
      } else {
        res.sendStatus(403);
        return;
      }
    } catch (err) {}
    res.sendStatus(success ? 200 : 403);
  });

  /**
   * Gets the current values of Z80 registers
   */
  app.get("/z80-regs", (_req, res) => {
    const s = mainProcessStore.getState().vmInfo;
    const regs = s?.registers
      ? s.registers
      : <RegisterData>{
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
          wz: 0xffff,
        };
    res.json(regs);
  });

  /**
   * Gets the contents of the specified memory range
   */
  app.get("/memory", async (_req, res) => {
    try {
      const contents = (
        await AppWindow.instance.sendMessageToRenderer<GetMemoryContentsResponse>(
          {
            type: "getMemoryContents",
          }
        )
      ).contents;
      res.send(Buffer.from(contents).toString("base64"));
    } catch (err) {
      console.log(err);
      res.status(500).send(err.toString());
    }
  });

  /**
   * Gets the contents of the specified memory range
   */
  app.get("/machine-state", async (_req, res) => {
    try {
      const state = (
        await AppWindow.instance.sendMessageToRenderer<GetMachineStateResponse>(
          {
            type: "getMachineState",
          }
        )
      ).state;
      res.json(state);
    } catch (err) {
      console.log(err);
      res.status(500).send(err.toString());
    }
  });

  /**
   * Gets the list of breakpoints
   */
  app.get("/breakpoints", (_req, res) => {
    const state = mainProcessStore.getState();
    res.json({ breakpoints: Array.from(state.breakpoints) });
  });

  /**
   * Set breakpoints
   */
  app.post("/breakpoints", (req, res) => {
    const breakpoints = req.body?.breakpoints as number[];
    mainProcessStore.dispatch(breakpointSetAction(breakpoints)());
    res.sendStatus(204);
  });

  /**
   * Delete breakpoints
   */
  app.post("/delete-breakpoints", (req, res) => {
    const breakpoints = req.body?.breakpoints as number[];
    mainProcessStore.dispatch(breakpointRemoveAction(breakpoints)());
    res.sendStatus(204);
  });

  /**
   * Set the ide configuration
   */
  app.post("/ide-config", (req, res) => {
    const ideConfig: IdeConfiguration = {
      projectFolder: req.body?.projectFolder,
      saveFolder: req.body?.saveFolder,
    };
    mainProcessStore.dispatch(ideConfigSetAction(ideConfig)());
    res.sendStatus(204);
  });

  /**
   * Change the emulated machine type
   */
  app.get("/machine-type", (req, res) => {
    const state = mainProcessStore.getState();
    res.json({
      requestedType: state.emulatorPanelState.requestedType,
      currentType: state.emulatorPanelState.currentType,
    });
  });

  /**
   * Change the emulated machine type
   */
  app.post("/machine-type", (req, res) => {
    mainProcessStore.dispatch(
      emulatorRequestTypeAction(req.body?.type ?? "48")()
    );
    res.sendStatus(204);
  });

  /**
   * Injects code into the ZX Spectrum virtual machine
   */
  app.post("/inject-code", async (req, res) => {
    try {
      await AppWindow.instance.sendMessageToRenderer({
        type: "injectCode",
        codeToInject: req.body,
      });
      res.status(200).send("");
    } catch (err) {
      res.status(500).send(err.toString());
    }
  });

  app.post("/run-code", async (req, res) => {
    try {
      await AppWindow.instance.sendMessageToRenderer({
        type: "runCode",
        codeToInject: req.body.codeToInject,
        debug: req.body.debug,
      });
      res.status(200).send("");
    } catch (err) {
      res.status(500).send(err.toString());
    }
  });

  // --- Start the API server on the configured port
  const port = appConfiguration?.port ?? 3000;
  app.listen(port, () =>
    console.log(`Klive Emulator is listening on port ${port}...`)
  );
}
