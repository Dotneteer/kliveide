import { translator } from "@common/i18n/i18n";
import { SOURCE_CATALOG } from "@common/i18n/catalogs";

export type ErrorCodes =
  // --- Z80 Compiler Error Codes
  // --- Missing or faulty tokens
  | "Z0001"
  | "Z0002"
  | "Z0003"
  | "Z0004"
  | "Z0005"
  | "Z0006"
  | "Z0007"
  | "Z0008"

  // --- Missing or faulty language elements
  | "Z0101"
  | "Z0102"
  | "Z0103"
  | "Z0104"
  | "Z0105"
  | "Z0106"
  | "Z0107"
  | "Z0108"
  | "Z0109"
  | "Z0110"
  | "Z0111"
  | "Z0112"
  | "Z0113"
  | "Z0114"

  // --- Directive error messages
  | "Z0201"
  | "Z0202"
  | "Z0203"
  | "Z0204"
  | "Z0205"
  | "Z0206"
  | "Z0207"
  | "Z0208"
  | "Z0209"

  // --- Pragma messages
  | "Z0302"
  | "Z0303"
  | "Z0304"
  | "Z0305"
  | "Z0306"
  | "Z0307"
  | "Z0308"
  | "Z0309"
  | "Z0310"
  | "Z0311"
  | "Z0312"
  | "Z0313"
  | "Z0314"
  | "Z0315"
  | "Z0316"
  | "Z0317"
  | "Z0318"
  | "Z0319"
  | "Z0320"
  | "Z0331"
  | "Z0321"
  | "Z0322"
  | "Z0323"
  | "Z0324"
  | "Z0325"
  | "Z0326"
  | "Z0327"
  | "Z0328"
  | "Z0329"
  | "Z0330"
  | "Z0331"
  | "Z0332"
  | "Z0333"
  | "Z0334"
  | "Z0335"
  | "Z0336"
  | "Z0337"
  
  // --- SaveNex pragma errors
  | "Z0340"
  // intentional gap: Z0353-Z0359 reserved
  | "Z0341"
  | "Z0342"
  | "Z0343"
  | "Z0344"
  | "Z0345"
  | "Z0346"
  | "Z0347"
  | "Z0348"
  | "Z0349"
  | "Z0350"
  | "Z0351"
  | "Z0352"

  // --- DMA pragma errors
  | "Z0360"
  | "Z0361"
  | "Z0362"
  | "Z0363"
  | "Z0364"
  | "Z0365"
  | "Z0366"
  | "Z0367"
  | "Z0368"

  // --- Copper pragma errors
  | "Z0371"
  | "Z0372"
  | "Z0373"
  | "Z0374"
  | "Z0375"
  | "Z0376"
  | "Z0377"

  // --- Next model warnings
  | "Z0370"

  // --- ZX80/ZX81 models
  | "Z0378"
  | "Z0379"
  | "Z0380"
  | "Z0381"

  // --- HT-1080Z model
  | "Z0382"
  | "Z0383"

  // --- Instructions
  | "Z0401"
  | "Z0402"
  | "Z0403"
  | "Z0404"
  | "Z0405"
  | "Z0406"
  | "Z0407"
  | "Z0408"
  | "Z0409"
  | "Z0410"
  | "Z0411"
  | "Z0412"
  | "Z0413"
  | "Z0414"

  // --- Labels and symbols
  | "Z0501"
  | "Z0502"
  | "Z0503"
  | "Z0504"
  | "Z0505"

  // --- Expressions and operands
  | "Z0601"
  | "Z0602"
  | "Z0603"
  | "Z0604"
  | "Z0605"
  | "Z0606"

  // --- Statements
  | "Z0701"
  | "Z0702"
  | "Z0703"
  | "Z0704"
  | "Z0705"
  | "Z0706"
  | "Z0707"
  | "Z0708"
  | "Z0709"

  // --- Structs
  | "Z0801"
  | "Z0802"
  | "Z0803"
  | "Z0804"
  | "Z0805"
  | "Z0806"
  | "Z0807"
  | "Z0808"
  | "Z0809"
  | "Z0810"

  // --- Modules
  | "Z0901"
  | "Z0902"
  | "Z0903"

  // --- Macros
  | "Z1001"
  | "Z1002"
  | "Z1003"
  | "Z1004"
  | "Z1005"
  | "Z1006"
  | "Z1007"
  | "Z1008"
  | "Z1009"
  | "Z1010"
  | "Z1011"
  | "Z1012"
  | "Z1013"
  | "Z1014"

  // --- Others
  | "Z2000"

  // --- M6510 Compiler Error Codes
  | "M1001"
  | "M1002"
  | "M1003"
  | "M1004"
  | "M1005"
  | "M1006"
  | "M1007"
  | "M1008"
  | "M1009";

/**
 * The text of an assembler error or warning, in the display language
 * (`.plans/LOCALIZATION_PLAN.md` step 13). The English is `compiler.asm.<code>` in
 * `src/common/i18n/locales/en/compiler.json`; `{0}`, `{1}`... are the parameters, in order. A
 * compile in the worker thread sets the worker's language from the app state it receives.
 * @returns undefined for a code without a message
 */
// i18n-dynamic: compiler.asm.
export function assemblerMessage(code: string, params?: readonly unknown[]): string | undefined {
  const key = `compiler.asm.${code}`;
  if (SOURCE_CATALOG[key] === undefined) return undefined;
  const args: Record<string, string> = {};
  (params ?? []).forEach((p, i) => (args[String(i)] = String(p)));
  return translator.t(key, args);
}
