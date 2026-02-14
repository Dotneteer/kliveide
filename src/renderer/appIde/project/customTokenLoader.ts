import { MonacoAwareCustomLanguageInfo } from "@renderer/abstractions/CustomLanguageInfo";

const ipcRenderer = (window as any).electron?.ipcRenderer;

/**
 * Loads custom token colors from JSON files stored in the Klive settings folder.
 * Token files are named as <languageId>.tokens.json
 * 
 * @param languageProviders Array of language providers to apply custom tokens to
 */
export async function loadCustomTokenColors(
  languageProviders: MonacoAwareCustomLanguageInfo[]
): Promise<void> {
  if (!ipcRenderer) {
    // IPC not available, skip custom token loading
    return;
  }

  for (const provider of languageProviders) {
    try {
      // Request custom tokens from main process via IPC
      const customTokens = await ipcRenderer.invoke('load-custom-tokens', provider.id);
      
      if (!customTokens) {
        continue;
      }

      // Apply custom tokens to dark theme
      if (customTokens.darkTheme && provider.darkTheme) {
        applyCustomTokens(provider.darkTheme.rules, customTokens.darkTheme);
      }

      // Apply custom tokens to light theme
      if (customTokens.lightTheme && provider.lightTheme) {
        applyCustomTokens(provider.lightTheme.rules, customTokens.lightTheme);
      }
    } catch (error) {
      // Silently skip errors as per requirements
      continue;
    }
  }
}

/**
 * Applies custom token definitions to existing theme rules.
 * Supports both simple string values (foreground color only) and object values (with fontStyle).
 * 
 * @param rules Array of existing theme rules
 * @param customTokens Custom token definitions from JSON file
 */
function applyCustomTokens(
  rules: Array<{ token: string; foreground?: string; fontStyle?: string }>,
  customTokens: Record<string, string | { foreground?: string; fontStyle?: string }>
): void {
  for (const [tokenName, tokenValue] of Object.entries(customTokens)) {
    // Find the existing rule for this token
    const existingRuleIndex = rules.findIndex((rule) => rule.token === tokenName);

    // Prepare the new rule values
    let foreground: string | undefined;
    let fontStyle: string | undefined;

    if (typeof tokenValue === "string") {
      // Simple string value - just the foreground color
      foreground = tokenValue;
    } else if (typeof tokenValue === "object" && tokenValue !== null) {
      // Object value - can include foreground and fontStyle
      foreground = tokenValue.foreground;
      fontStyle = tokenValue.fontStyle;
    } else {
      // Invalid value, skip
      continue;
    }

    if (existingRuleIndex >= 0) {
      // Update existing rule
      const existingRule = rules[existingRuleIndex];
      if (foreground !== undefined) {
        existingRule.foreground = foreground;
      }
      if (fontStyle !== undefined) {
        existingRule.fontStyle = fontStyle;
      }
    } else {
      // Add new rule
      const newRule: { token: string; foreground?: string; fontStyle?: string } = {
        token: tokenName
      };
      if (foreground !== undefined) {
        newRule.foreground = foreground;
      }
      if (fontStyle !== undefined) {
        newRule.fontStyle = fontStyle;
      }
      rules.push(newRule);
    }
  }
}
