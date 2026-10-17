export type BorielKit = { file: string; size: number; sha256: string };
export type BorielKitManifest = {
  product: string;
  version: string;
  urlBase: string;
  mirrors?: string[];
  kits: Record<string, BorielKit>;
};
export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
export type KitOptions = {
  vendorFolder?: string;
  manifest?: BorielKitManifest;
  fetch?: FetchLike;
  log?: (line: string) => void;
};
export const VENDOR_FOLDER: string;
export function readKitManifest(vendorFolder?: string): BorielKitManifest;
export function kitKey(platform: string, arch: string): string;
export function verifyKitFile(file: string, kit: BorielKit): boolean;
export function kitUrls(manifest: BorielKitManifest, kit: BorielKit): string[];
export function ensureKit(key: string, options?: KitOptions): Promise<string>;
export function stageKit(key: string, options?: KitOptions): Promise<string>;
