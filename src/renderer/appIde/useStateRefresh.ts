import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEffect } from "react";
import { CpuStateChunk, EmuApi } from "@common/messaging/EmuApi";
import { reportRefreshError } from "@renderer/machineRebuildRejections";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";

type Callback = (state: MachineControllerState) => Promise<void>;

/*
 * While the emulator rebuilds its machine (a machine, model or LCD-size change) it has no machine
 * controller for a moment, and every request is answered with "Machine controller not available".
 * The poll skips that round and the panels' refreshes drop it; the next round, against the new
 * machine, refreshes them. Any other failure is still reported - as a console error, never as an
 * unhandled rejection from a timer or an effect (`reportRefreshError`).
 */

/** Runs a panel's refresh; its failure is handled (see `reportRefreshError`) */
function runRefresh(callback: Callback, state: MachineControllerState): void {
  Promise.resolve()
    .then(() => callback(state))
    .catch(reportRefreshError);
}

class EmuStateListener {
  static instance: EmuStateListener;
  private readonly intervalTime = 100; // 100ms interval
  private intervalId: NodeJS.Timeout | null = null;
  private callbacks = new Set<Callback>();
  private oldState: CpuStateChunk | null = null;
  private lastRefresh = new Date().valueOf();
  private isRunning = false;

  static getInstanceWith(emuApi: EmuApi): EmuStateListener {
    if (!EmuStateListener.instance) {
      EmuStateListener.instance = new EmuStateListener(emuApi);
    }
    return EmuStateListener.instance;
  }

  private constructor(public readonly emuApi: EmuApi) {}

  private startTimer() {
    if (this.intervalId) return; // Prevent duplicate timers

    this.intervalId = setInterval(() => {
      (async () => {
        if (this.isRunning) return;

        this.isRunning = true;
        try {
          let newState: CpuStateChunk;
          try {
            newState = await this.emuApi.getCpuStateChunk();
          } catch (error) {
            // --- No machine this round: the next state is the new machine's, so refresh then
            this.oldState = null;
            reportRefreshError(error);
            return;
          }
          const changed =
            !this.oldState ||
            this.oldState.state !== newState.state ||
            this.oldState.pcValue !== newState.pcValue ||
            this.oldState.tacts !== newState.tacts ||
            // --- A history cursor move (LITE_STEP_BACK_PLAN D3): two steps can share a PC
            (this.oldState.historyPosition ?? 0) !== (newState.historyPosition ?? 0);
          if (changed) {
            if (newState.state === MachineControllerState.Paused) {
              // --- The machine is paused, refresh the state immediately
              this.callbacks.forEach((cb) => runRefresh(cb, newState.state));
              this.lastRefresh = new Date().valueOf();
            } else if (new Date().valueOf() - this.lastRefresh > 750) {
              this.callbacks.forEach((cb) => runRefresh(cb, newState.state));
              this.lastRefresh = new Date().valueOf();
            }
          } else if (new Date().valueOf() - this.lastRefresh > 5000) {
            this.lastRefresh = new Date().valueOf();
            this.callbacks.forEach((cb) => runRefresh(cb, newState.state));
          }
          this.oldState = newState;
        } finally {
          this.isRunning = false;
        }
      })();
    }, this.intervalTime);
  }

  subscribe(callback: Callback) {
    this.callbacks.add(callback);
    this.startTimer();
  }

  unsubscribe(callback: Callback) {
    this.callbacks.delete(callback);
    if (this.callbacks.size === 0 && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export function useEmuStateListener(emuApi: EmuApi, callback: Callback, onInit = true): void {
  const listener = EmuStateListener.getInstanceWith(emuApi);

  useInitializeAsync(async () => {
    if (onInit) {
      try {
        const state = await emuApi.getCpuStateChunk();
        runRefresh(callback, state.state);
      } catch (error) {
        reportRefreshError(error);
      }
    }
  });

  useEffect(() => {
    listener.subscribe(callback);
    return () => {
      listener.unsubscribe(callback);
    };
  }, [emuApi, callback]);
}
