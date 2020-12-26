import * as express from "express";
import * as bodyParser from "body-parser";
import * as fs from "fs";

import { mainProcessStore } from "../main/mainProcessStore";
import {
  emulatorSetTapeContenstAction,
  emulatorRequestTypeAction,
} from "../shared/state/redux-emulator-state";
import { checkTapeFile } from "../shared/tape/readers";
import { BinaryReader } from "../shared/utils/BinaryReader";
import { IdeConfiguration } from "../shared/state/AppState";
import { ideConfigSetAction } from "../shared/state/redux-ide-config-state";
import { appConfiguration } from "../main/klive-configuration";
import { ideConnectsAction } from "../shared/state/redux-ide-connection.state";
import { AppWindow } from "../main/AppWindow";
import {
  AddDiagnosticsFrameDataResponse,
  DefaultResponse,
  GetMachineStateResponse,
  GetMemoryContentsResponse,
} from "../shared/messaging/message-types";
import { DiagViewFrame } from "../shared/machines/diag-info";

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
  app.get("/frame-info", async (_req, res) => {
    try {
      const state = mainProcessStore.getState();
      const emuState = state.emulatorPanelState;
      const vmInfo = state.vmInfo;
      const diagData = <DiagViewFrame> {
        startCount: emuState.startCount,
        frameCount: emuState.frameCount,
        executionState: emuState.executionState,
        pc: vmInfo.registers?.pc ?? -1,
        runsInDebug: emuState.runsInDebug,
        machineType: emuState.currentType,
      }
        const frame = (
        await AppWindow.instance.sendMessageToRenderer<AddDiagnosticsFrameDataResponse>(
          {
            type: "addDiagnosticsFrameData",
            frame: diagData
          }
        )
      ).frame;
      res.json(frame);
    } catch (err) {
      console.log(err);
      res.status(500).send(err.toString());
    }
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
   * Set breakpoints
   */
  app.post("/breakpoints", async (req, res) => {
    try {
      const contents = (
        await AppWindow.instance.sendMessageToRenderer<DefaultResponse>(
          {
            type: "setBreakpoints",
            breakpoints: req.body.breakpoints 
          }
        )
      );
      res.sendStatus(204);
    } catch (err) {
      console.log(err);
      res.status(500).send(err.toString());
    }
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
