import type { NextMachine } from "../core/machines";

/*
 * The device on the other end of a Next UART's serial lines (UART 0: the ESP socket, UART 1: the Pi
 * GPIO). The core models the lines a frame at a time on the 28 MHz clock (zxnext-uart.c); this adapter
 * reaches its peer API.
 */

/** A frame the peer sends: a byte, or a byte with a wrong parity bit or a low stop bit. */
export type UartFrame = number | { value: number; error?: "parity" | "framing" };

export type UartIndex = 0 | 1;

const KIND_CODES = { byte: 0, parity: 1, framing: 2 } as const;

export interface UartPeer {
  send(uart: UartIndex, frames: ArrayLike<UartFrame>): void;
  setBreak(uart: UartIndex, on: boolean): void;
  setCts(uart: UartIndex, clear: boolean): void;
  setLoopback(uart: UartIndex, on: boolean): void;
  readyToReceive(uart: UartIndex): boolean;
  output(uart: UartIndex): number[];
}

function normalize(frame: UartFrame): { value: number; kind: "byte" | "parity" | "framing" } {
  return typeof frame === "number" ? { value: frame & 0xff, kind: "byte" } : { value: frame.value & 0xff, kind: frame.error ?? "byte" };
}

export function uartPeerOf(machine: NextMachine): UartPeer {
  const x = machine.wasmV2Runtime!.exports;
  return {
    send: (uart, frames) => {
      for (let i = 0; i < frames.length; i++) {
        const f = normalize(frames[i]);
        x.zxnextUartPeerSend(uart, f.value, KIND_CODES[f.kind]);
      }
    },
    setBreak: (uart, on) => x.zxnextUartPeerBreak(uart, on ? 1 : 0),
    setCts: (uart, clear) => x.zxnextUartPeerSetCts(uart, clear ? 1 : 0),
    setLoopback: (uart, on) => x.zxnextUartPeerSetLoopback(uart, on ? 1 : 0),
    readyToReceive: (uart) => x.zxnextUartPeerReadyToReceive(uart) !== 0,
    output: (uart) => Array.from({ length: x.zxnextUartPeerOutputCount(uart) }, (_, i) => x.zxnextUartPeerOutputByte(uart, i))
  };
}
