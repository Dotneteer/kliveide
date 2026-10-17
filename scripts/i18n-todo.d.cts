export type TodoEntry = {
  key: string;
  english: string;
  context: string;
  maxChars?: number;
  placeholders?: Record<string, string>;
  status?: "outdated";
  oldEnglish?: string;
  currentTranslation?: string;
};
export function buildTodo(options: { localesDir?: string; lang: string; ns?: string; limit?: number }): {
  language: string;
  instructions: string;
  entries: TodoEntry[];
};
