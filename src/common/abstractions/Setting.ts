export type Setting = {
  id: string;
  title: string;
  description?: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "any";
  defaultValue?: any;
  saveWithIde?: boolean;
  saveWithProject?: boolean;
};
