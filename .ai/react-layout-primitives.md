# React Layout Primitives

Layout primitives now live as real component files under `src/renderer/controls/layout`.

Use direct imports:

```ts
import { FullPanel, HStack, VStack } from "@renderer/controls/layout/Panels";
import { Row } from "@renderer/controls/layout/Row";
import { Label } from "@renderer/controls/layout/Label";
```

Do not add compatibility files that only re-export moved layout components from `controls/generic`, `controls/new`, or `common`.

`controls/generic` currently remains only for non-layout generic controls such as `KeyHandler`.

## Move Verification

When deleting or moving component files, do not only scan alias imports. Also scan relative imports from nearby folders.

Useful checks:

```sh
rg "from ['\"][^'\"]*(generic/(Column|ExpandableRow|Flag|FlagRow|Label|LabelSeparator|LabeledFlag|LabeledText|Panel|Row|Secondary|Separator|Text|Value)|new/(Panels|PanelProps)|common/(HStack|VStack|Stack)|\./generic/(Column|ExpandableRow|Flag|FlagRow|Label|LabelSeparator|LabeledFlag|LabeledText|Panel|Row|Secondary|Separator|Text|Value)|\.\./generic/(Column|ExpandableRow|Flag|FlagRow|Label|LabelSeparator|LabeledFlag|LabeledText|Panel|Row|Secondary|Separator|Text|Value)|\./new/Panels|\.\./new/Panels)" src test -g "*.ts" -g "*.tsx"
npx electron-vite build --config build/electron.vite.config.ts
```

`npm run build:check` can miss this class of issue because TypeScript path checks are not the same as Vite/Rollup import analysis.
