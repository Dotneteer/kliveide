import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEffect } from "react";
import { CpuStateChunk, EmuApi } from "@common/messaging/EmuApi";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";

type Callback = (state: MachineControllerState) => Promise<void>;

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
          const newState = await this.emuApi.getCpuStateChunk();
          const changed =
            !this.oldState ||
            this.oldState.state !== newState.state ||
            this.oldState.pcValue !== newState.pcValue ||
            this.oldState.tacts !== newState.tacts;
          if (changed) {
            if (newState.state === MachineControllerState.Paused) {
              // --- The machine is paused, refresh the state immediately
              this.callbacks.forEach((cb) => cb(newState.state));
              this.lastRefresh = new Date().valueOf();
            } else if (new Date().valueOf() - this.lastRefresh > 750) {
              this.callbacks.forEach((cb) => cb(newState.state));
              this.lastRefresh = new Date().valueOf();
            }
          } else if (new Date().valueOf() - this.lastRefresh > 5000) {
            this.lastRefresh = new Date().valueOf();
            this.callbacks.forEach((cb) => cb(newState.state));
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
      const state = await emuApi.getCpuStateChunk();
      callback(state.state);
    }
  });

  useEffect(() => {
    listener.subscribe(callback);
    return () => {
      listener.unsubscribe(callback);
    };
  }, [emuApi, callback]);
}
