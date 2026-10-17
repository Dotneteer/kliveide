export function checkI18n(options?: {
  localesDir?: string;
  sourceDirs?: string[];
  catalogsFile?: string;
  keysFile?: string;
  translationsFile?: string;
  update?: boolean;
}): Promise<{
  errors: string[];
  warnings: string[];
  info: string[];
  keys: string[];
  status: Record<string, { translated: number; total: number; outdated: number }>;
}>;
export function renderKeysFile(keys: string[]): string;
