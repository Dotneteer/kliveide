/**
 * Describes an option that can be passed to a utility process
 */
export type CmdLineOptionDescriptor = {
  optionName?: string;  
  description: string;
  type: "string" | "number" | "boolean";
  isArray?: boolean;
};

/**
 * Describes a set of options that can be passed to a utility process
 */
export type CmdLineOptionSet = Record<string, CmdLineOptionDescriptor>;