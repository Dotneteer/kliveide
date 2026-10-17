export function mergeTranslations(options: {
  localesDir?: string;
  lang: string;
  answer: Record<string, unknown>;
  dryRun?: boolean;
  translationsFile?: string;
}): Promise<{ accepted: number; rejected: { key: string; reason: string }[] }>;
export function extractJsonObject(text: string): Record<string, unknown>;
