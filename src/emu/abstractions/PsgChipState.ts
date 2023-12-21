/**
 * This type represents the state of the PSG chip
 */
export type PsgChipState = {
  // --- The last register index set
  psgRegisterIndex: number;

  // --- The last values of the PSG registers set
  regValues: Uint8Array;

  // --- Channel A
  toneA: number;
  toneAEnabled: boolean;
  noiseAEnabled: boolean;
  volA: number;
  envA: boolean;
  cntA: number;
  bitA: boolean;

  // --- Channel B
  toneB: number;
  toneBEnabled: boolean;
  noiseBEnabled: boolean;
  volB: number;
  envB: boolean;
  cntB: number;
  bitB: boolean;

  // --- Channel C
  toneC: number;
  toneCEnabled: boolean;
  noiseCEnabled: boolean;
  volC: number;
  envC: boolean;
  cntC: number;
  bitC: boolean;

  // --- Noise
  noiseSeed: number;
  noiseFreq: number;
  cntNoise: number;
  bitNoise: boolean;

  // --- Envelope data
  envFreq: number;
  envStyle: number; // 8-bit
  cntEnv: number;
  posEnv: number;
};
