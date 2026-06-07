export type SettingValueType = "string" | "number" | "boolean" | "array" | "object" | "any";

export type Setting = {
  id: string;
  title: string;
  description?: string;
  type: SettingValueType;
  defaultValue?: unknown;
  persist?: boolean;
  saveWithIde?: boolean;
  saveWithProject?: boolean;
  boundTo?: "emu" | "ide";
  volatile?: boolean;
};
