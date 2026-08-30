export const NEX_ANNOTATION_SCHEMA_VERSION = 1;
export const NEX_BANK_SIZE = 0x4000;
export const NEX_BANK_LAST_OFFSET = NEX_BANK_SIZE - 1;
export const NEX_MAX_BANK = 111;
export const NEX_LABEL_MAX_LENGTH = 16;

export type NexAnnotationOffsetIndex = 0 | 1 | 2 | 3;
export type NexAnnotationRegionType = "disassemble" | "bytes" | "words" | "skip";
export type NexAnnotationLabelScope = "global" | "local";
export type NexAnnotationBankView = "memory" | "disassembly";

export type NexAnnotationDiagnostic = {
  severity: "error" | "warning";
  path: string;
  message: string;
};

export type NexAnnotationSource = {
  fileName?: string;
  sha256?: string;
};

export type NexAnnotationLabel = {
  name: string;
  value: number;
};

export type NexAnnotationRegion = {
  start: number;
  end: number;
  type: NexAnnotationRegionType;
};

export type NexLineAnnotation = {
  synopsis?: string;
  comment?: string;
};

export type NexOperandReference = {
  operandIndex: number;
  scope: NexAnnotationLabelScope;
  name: string;
};

export type NexBankAnnotation = {
  offsetIndex: NexAnnotationOffsetIndex;
  lastView?: NexAnnotationBankView;
  decimalView?: boolean;
  regions: NexAnnotationRegion[];
  localLabels?: NexAnnotationLabel[];
  lineAnnotations?: Record<string, NexLineAnnotation>;
  operandReferences?: Record<string, NexOperandReference[]>;
};

export type NexFileAnnotations = {
  schemaVersion: typeof NEX_ANNOTATION_SCHEMA_VERSION;
  source?: NexAnnotationSource;
  globalLabels?: NexAnnotationLabel[];
  banks: Record<string, NexBankAnnotation>;
};

export type CreateDefaultNexAnnotationsOptions = {
  nexPath?: string;
  nexFileName?: string;
  sha256?: string;
  loadedBanks: number[];
  getDefaultOffsetIndex?: (bank: number) => NexAnnotationOffsetIndex;
};

export type ParseNexAnnotationsOptions = {
  loadedBanks?: number[];
};

export type ParseNexAnnotationsResult = {
  annotations?: NexFileAnnotations;
  diagnostics: NexAnnotationDiagnostic[];
};

export type ResolvedNexAnnotationLabel = NexAnnotationLabel & {
  scope: NexAnnotationLabelScope;
  bank?: number;
};

const LABEL_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const REGION_TYPES = new Set<NexAnnotationRegionType>([
  "disassemble",
  "bytes",
  "words",
  "skip"
]);
const LABEL_SCOPES = new Set<NexAnnotationLabelScope>(["global", "local"]);
const BANK_VIEWS = new Set<NexAnnotationBankView>(["memory", "disassembly"]);
const DEFAULT_REGION: NexAnnotationRegion = {
  start: 0,
  end: NEX_BANK_LAST_OFFSET,
  type: "disassemble"
};

export function getNexAnnotationPath(nexPath: string): string {
  return `${nexPath}.dis`;
}

export function isNexAnnotationPath(path: string): boolean {
  return path.toLowerCase().endsWith(".nex.dis");
}

export function getNexBankAddressOffset(offsetIndex: NexAnnotationOffsetIndex): number {
  return offsetIndex * NEX_BANK_SIZE;
}

export function getNexBankOffsetIndex(addressOffset: number): NexAnnotationOffsetIndex | undefined {
  if (!Number.isInteger(addressOffset) || addressOffset % NEX_BANK_SIZE !== 0) {
    return undefined;
  }
  const offsetIndex = addressOffset / NEX_BANK_SIZE;
  return isIntegerInRange(offsetIndex, 0, 3)
    ? offsetIndex as NexAnnotationOffsetIndex
    : undefined;
}

export function isValidNexLabelName(name: string): boolean {
  return name.length > 0 && name.length <= NEX_LABEL_MAX_LENGTH && LABEL_NAME_PATTERN.test(name);
}

export function createDefaultNexAnnotations(
  options: CreateDefaultNexAnnotationsOptions
): NexFileAnnotations {
  const banks: Record<string, NexBankAnnotation> = {};
  for (const bank of options.loadedBanks) {
    if (!isIntegerInRange(bank, 0, NEX_MAX_BANK)) {
      continue;
    }
    banks[String(bank)] = {
      offsetIndex: options.getDefaultOffsetIndex?.(bank) ?? 0,
      regions: [{ ...DEFAULT_REGION }]
    };
  }

  return {
    schemaVersion: NEX_ANNOTATION_SCHEMA_VERSION,
    source: createSourceInfo(options),
    globalLabels: [],
    banks
  };
}

export function parseNexAnnotations(
  contents: string,
  options: ParseNexAnnotationsOptions = {}
): ParseNexAnnotationsResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (err) {
    return {
      diagnostics: [
        error("$", `Annotation JSON cannot be parsed: ${err instanceof Error ? err.message : err}`)
      ]
    };
  }
  return validateNexAnnotations(parsed, options);
}

export function validateNexAnnotations(
  value: unknown,
  options: ParseNexAnnotationsOptions = {}
): ParseNexAnnotationsResult {
  const diagnostics: NexAnnotationDiagnostic[] = [];
  if (!isRecord(value)) {
    return { diagnostics: [error("$", "Annotation root must be a JSON object.")] };
  }

  if (value.schemaVersion !== NEX_ANNOTATION_SCHEMA_VERSION) {
    diagnostics.push(
      error("$.schemaVersion", `schemaVersion must be ${NEX_ANNOTATION_SCHEMA_VERSION}.`)
    );
  }

  const source = readSource(value.source, "$.source", diagnostics);
  const globalLabels = readLabels(value.globalLabels, "$.globalLabels", 0xffff, diagnostics);
  const banks = readBanks(value.banks, globalLabels, options, diagnostics);

  if (diagnostics.some((item) => item.severity === "error")) {
    return { diagnostics };
  }

  const annotations: NexFileAnnotations = {
    schemaVersion: NEX_ANNOTATION_SCHEMA_VERSION,
    banks
  };
  if (source) {
    annotations.source = source;
  }
  if (globalLabels.length > 0 || Array.isArray(value.globalLabels)) {
    annotations.globalLabels = globalLabels;
  }
  return { annotations, diagnostics };
}

export function getBankAnnotation(
  annotations: NexFileAnnotations,
  bank: number
): NexBankAnnotation | undefined {
  return annotations.banks[String(bank)];
}

export function getLabelsAtBankOffset(
  annotations: NexFileAnnotations,
  bank: number,
  bankOffset: number,
  offsetIndex?: NexAnnotationOffsetIndex
): ResolvedNexAnnotationLabel[] {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  const effectiveOffsetIndex = offsetIndex ?? bankAnnotation?.offsetIndex ?? 0;
  const effectiveAddress = (getNexBankAddressOffset(effectiveOffsetIndex) + bankOffset) & 0xffff;
  const labels: ResolvedNexAnnotationLabel[] = [];

  for (const label of annotations.globalLabels ?? []) {
    if (label.value === effectiveAddress) {
      labels.push({ ...label, scope: "global" });
    }
  }

  for (const label of bankAnnotation?.localLabels ?? []) {
    if (label.value === bankOffset) {
      labels.push({ ...label, scope: "local", bank });
    }
  }

  return labels;
}

export function getOperandLabelCandidates(
  annotations: NexFileAnnotations,
  bank: number,
  operandValue: number,
  offsetIndex?: NexAnnotationOffsetIndex
): ResolvedNexAnnotationLabel[] {
  const bankAnnotation = getBankAnnotation(annotations, bank);
  const effectiveOffsetIndex = offsetIndex ?? bankAnnotation?.offsetIndex ?? 0;
  const bankRelativeValue = operandValue - getNexBankAddressOffset(effectiveOffsetIndex);
  const labels: ResolvedNexAnnotationLabel[] = [];

  for (const label of annotations.globalLabels ?? []) {
    if (label.value === operandValue) {
      labels.push({ ...label, scope: "global" });
    }
  }

  if (isIntegerInRange(bankRelativeValue, 0, NEX_BANK_LAST_OFFSET)) {
    for (const label of bankAnnotation?.localLabels ?? []) {
      if (label.value === bankRelativeValue) {
        labels.push({ ...label, scope: "local", bank });
      }
    }
  }

  return labels;
}

function createSourceInfo(options: CreateDefaultNexAnnotationsOptions): NexAnnotationSource {
  const source: NexAnnotationSource = {};
  const fileName = options.nexFileName ?? getFileName(options.nexPath);
  if (fileName) {
    source.fileName = fileName;
  }
  if (options.sha256) {
    source.sha256 = options.sha256;
  }
  return source;
}

function getFileName(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || undefined;
}

function readSource(
  value: unknown,
  path: string,
  diagnostics: NexAnnotationDiagnostic[]
): NexAnnotationSource | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push(error(path, "source must be an object when specified."));
    return undefined;
  }

  const source: NexAnnotationSource = {};
  if (value.fileName !== undefined) {
    if (typeof value.fileName !== "string") {
      diagnostics.push(error(`${path}.fileName`, "fileName must be a string."));
    } else {
      source.fileName = value.fileName;
    }
  }
  if (value.sha256 !== undefined) {
    if (typeof value.sha256 !== "string") {
      diagnostics.push(error(`${path}.sha256`, "sha256 must be a string."));
    } else {
      source.sha256 = value.sha256;
    }
  }
  return source;
}

function readBanks(
  value: unknown,
  globalLabels: NexAnnotationLabel[],
  options: ParseNexAnnotationsOptions,
  diagnostics: NexAnnotationDiagnostic[]
): Record<string, NexBankAnnotation> {
  const banks: Record<string, NexBankAnnotation> = {};
  if (!isRecord(value)) {
    diagnostics.push(error("$.banks", "banks must be an object."));
    return banks;
  }

  const loadedBankSet = options.loadedBanks ? new Set(options.loadedBanks) : undefined;
  for (const [bankKey, bankValue] of Object.entries(value)) {
    const bank = Number(bankKey);
    const bankPath = `$.banks.${bankKey}`;
    if (!/^(0|[1-9][0-9]*)$/.test(bankKey) || !isIntegerInRange(bank, 0, NEX_MAX_BANK)) {
      diagnostics.push(error(bankPath, `Bank key must be an integer from 0 to ${NEX_MAX_BANK}.`));
      continue;
    }
    if (loadedBankSet && !loadedBankSet.has(bank)) {
      diagnostics.push(warning(bankPath, "Bank is not present in the loaded NEX file."));
    }
    const bankAnnotation = readBankAnnotation(
      bankValue,
      bank,
      bankPath,
      globalLabels,
      diagnostics
    );
    if (bankAnnotation) {
      banks[bankKey] = bankAnnotation;
    }
  }
  return banks;
}

function readBankAnnotation(
  value: unknown,
  bank: number,
  path: string,
  globalLabels: NexAnnotationLabel[],
  diagnostics: NexAnnotationDiagnostic[]
): NexBankAnnotation | undefined {
  if (!isRecord(value)) {
    diagnostics.push(error(path, "Bank annotation must be an object."));
    return undefined;
  }

  const offsetIndex = readOffsetIndex(value.offsetIndex, `${path}.offsetIndex`, diagnostics);
  const lastView = readLastView(value.lastView, `${path}.lastView`, diagnostics);
  const decimalView = readOptionalBoolean(value.decimalView, `${path}.decimalView`, diagnostics);
  const localLabels = readLabels(value.localLabels, `${path}.localLabels`, NEX_BANK_LAST_OFFSET, diagnostics);
  const regions = normalizeRegions(value.regions, `${path}.regions`, diagnostics);
  const lineAnnotations = readLineAnnotations(value.lineAnnotations, `${path}.lineAnnotations`, diagnostics);
  const operandReferences = readOperandReferences(
    value.operandReferences,
    `${path}.operandReferences`,
    globalLabels,
    localLabels,
    diagnostics
  );

  if (offsetIndex === undefined) {
    return undefined;
  }

  const annotation: NexBankAnnotation = {
    offsetIndex,
    regions
  };
  if (lastView) {
    annotation.lastView = lastView;
  }
  if (decimalView !== undefined) {
    annotation.decimalView = decimalView;
  }
  if (localLabels.length > 0 || Array.isArray(value.localLabels)) {
    annotation.localLabels = localLabels;
  }
  if (lineAnnotations && Object.keys(lineAnnotations).length > 0) {
    annotation.lineAnnotations = lineAnnotations;
  }
  if (operandReferences && Object.keys(operandReferences).length > 0) {
    annotation.operandReferences = operandReferences;
  }
  return annotation;
}

function readOffsetIndex(
  value: unknown,
  path: string,
  diagnostics: NexAnnotationDiagnostic[]
): NexAnnotationOffsetIndex | undefined {
  if (value === undefined) {
    return 0;
  }
  if (!isIntegerInRange(value, 0, 3)) {
    diagnostics.push(error(path, "offsetIndex must be 0, 1, 2, or 3."));
    return undefined;
  }
  return value as NexAnnotationOffsetIndex;
}

function readLastView(
  value: unknown,
  path: string,
  diagnostics: NexAnnotationDiagnostic[]
): NexAnnotationBankView | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!BANK_VIEWS.has(value as NexAnnotationBankView)) {
    diagnostics.push(error(path, "lastView must be memory or disassembly."));
    return undefined;
  }
  return value as NexAnnotationBankView;
}

function readOptionalBoolean(
  value: unknown,
  path: string,
  diagnostics: NexAnnotationDiagnostic[]
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    diagnostics.push(error(path, "decimalView must be a boolean."));
    return undefined;
  }
  return value;
}

function normalizeRegions(
  value: unknown,
  path: string,
  diagnostics: NexAnnotationDiagnostic[]
): NexAnnotationRegion[] {
  if (value === undefined) {
    return [{ ...DEFAULT_REGION }];
  }
  if (!Array.isArray(value)) {
    diagnostics.push(error(path, "regions must be an array."));
    return [{ ...DEFAULT_REGION }];
  }
  if (value.length === 0) {
    return [{ ...DEFAULT_REGION }];
  }

  const regions: NexAnnotationRegion[] = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      diagnostics.push(error(itemPath, "Region must be an object."));
      return;
    }
    if (!isIntegerInRange(item.start, 0, NEX_BANK_LAST_OFFSET)) {
      diagnostics.push(error(`${itemPath}.start`, "Region start must be in the range 0..0x3fff."));
      return;
    }
    if (!isIntegerInRange(item.end, 0, NEX_BANK_LAST_OFFSET)) {
      diagnostics.push(error(`${itemPath}.end`, "Region end must be in the range 0..0x3fff."));
      return;
    }
    if (item.start > item.end) {
      diagnostics.push(error(itemPath, "Region start must be less than or equal to end."));
      return;
    }
    if (!REGION_TYPES.has(item.type as NexAnnotationRegionType)) {
      diagnostics.push(error(`${itemPath}.type`, "Region type is not supported."));
      return;
    }
    if (item.type === "words" && (item.end - item.start + 1) % 2 !== 0) {
      diagnostics.push(error(itemPath, "Word regions must contain an even number of bytes."));
      return;
    }
    regions.push({
      start: item.start,
      end: item.end,
      type: item.type as NexAnnotationRegionType
    });
  });

  if (regions.length === 0) {
    return [{ ...DEFAULT_REGION }];
  }

  const sortedRegions = regions.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sortedRegions.length; i++) {
    if (sortedRegions[i].start <= sortedRegions[i - 1].end) {
      diagnostics.push(error(path, "Regions must not overlap."));
      return sortedRegions;
    }
  }

  const normalized: NexAnnotationRegion[] = [];
  let cursor = 0;
  for (const region of sortedRegions) {
    if (region.start > cursor) {
      normalized.push({
        start: cursor,
        end: region.start - 1,
        type: "disassemble"
      });
    }
    normalized.push(region);
    cursor = region.end + 1;
  }
  if (cursor <= NEX_BANK_LAST_OFFSET) {
    normalized.push({
      start: cursor,
      end: NEX_BANK_LAST_OFFSET,
      type: "disassemble"
    });
  }

  return mergeAdjacentRegions(normalized);
}

function mergeAdjacentRegions(regions: NexAnnotationRegion[]): NexAnnotationRegion[] {
  const merged: NexAnnotationRegion[] = [];
  for (const region of regions) {
    const previous = merged[merged.length - 1];
    if (previous && previous.end + 1 === region.start && previous.type === region.type) {
      previous.end = region.end;
    } else {
      merged.push({ ...region });
    }
  }
  return merged;
}

function readLabels(
  value: unknown,
  path: string,
  maxValue: number,
  diagnostics: NexAnnotationDiagnostic[]
): NexAnnotationLabel[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    diagnostics.push(error(path, "Labels must be an array."));
    return [];
  }

  const labels: NexAnnotationLabel[] = [];
  const names = new Set<string>();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      diagnostics.push(error(itemPath, "Label must be an object."));
      return;
    }
    if (typeof item.name !== "string" || !isValidNexLabelName(item.name)) {
      diagnostics.push(
        error(
          `${itemPath}.name`,
          `Label name must be a valid identifier up to ${NEX_LABEL_MAX_LENGTH} characters.`
        )
      );
      return;
    }
    if (names.has(item.name)) {
      diagnostics.push(error(`${itemPath}.name`, "Duplicate label name in the same scope."));
      return;
    }
    if (!isIntegerInRange(item.value, 0, maxValue)) {
      diagnostics.push(error(`${itemPath}.value`, `Label value must be in the range 0..0x${maxValue.toString(16)}.`));
      return;
    }
    names.add(item.name);
    labels.push({
      name: item.name,
      value: item.value
    });
  });
  return labels;
}

function readLineAnnotations(
  value: unknown,
  path: string,
  diagnostics: NexAnnotationDiagnostic[]
): Record<string, NexLineAnnotation> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push(error(path, "lineAnnotations must be an object."));
    return undefined;
  }

  const annotations: Record<string, NexLineAnnotation> = {};
  for (const [offsetKey, annotationValue] of Object.entries(value)) {
    const itemPath = `${path}.${offsetKey}`;
    if (!isBankOffsetKey(offsetKey)) {
      diagnostics.push(error(itemPath, "Line annotation key must be a bank-relative offset."));
      continue;
    }
    if (!isRecord(annotationValue)) {
      diagnostics.push(error(itemPath, "Line annotation must be an object."));
      continue;
    }

    const annotation: NexLineAnnotation = {};
    if (annotationValue.synopsis !== undefined) {
      if (typeof annotationValue.synopsis !== "string") {
        diagnostics.push(error(`${itemPath}.synopsis`, "Synopsis comment must be a string."));
      } else if (annotationValue.synopsis.length > 0) {
        annotation.synopsis = annotationValue.synopsis;
      }
    }
    if (annotationValue.comment !== undefined) {
      if (typeof annotationValue.comment !== "string") {
        diagnostics.push(error(`${itemPath}.comment`, "End-of-line comment must be a string."));
      } else if (annotationValue.comment.length > 0) {
        annotation.comment = annotationValue.comment;
      }
    }
    if (annotation.synopsis !== undefined || annotation.comment !== undefined) {
      annotations[offsetKey] = annotation;
    }
  }
  return annotations;
}

function readOperandReferences(
  value: unknown,
  path: string,
  globalLabels: NexAnnotationLabel[],
  localLabels: NexAnnotationLabel[],
  diagnostics: NexAnnotationDiagnostic[]
): Record<string, NexOperandReference[]> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    diagnostics.push(error(path, "operandReferences must be an object."));
    return undefined;
  }

  const references: Record<string, NexOperandReference[]> = {};
  for (const [offsetKey, referenceValue] of Object.entries(value)) {
    const itemPath = `${path}.${offsetKey}`;
    if (!isBankOffsetKey(offsetKey)) {
      diagnostics.push(error(itemPath, "Operand reference key must be a bank-relative offset."));
      continue;
    }
    if (!Array.isArray(referenceValue)) {
      diagnostics.push(error(itemPath, "Operand references must be an array."));
      continue;
    }

    const normalizedReferences: NexOperandReference[] = [];
    referenceValue.forEach((item, index) => {
      const referencePath = `${itemPath}[${index}]`;
      if (!isRecord(item)) {
        diagnostics.push(error(referencePath, "Operand reference must be an object."));
        return;
      }
      if (!isIntegerInRange(item.operandIndex, 0, Number.MAX_SAFE_INTEGER)) {
        diagnostics.push(error(`${referencePath}.operandIndex`, "operandIndex must be a non-negative integer."));
        return;
      }
      if (!LABEL_SCOPES.has(item.scope as NexAnnotationLabelScope)) {
        diagnostics.push(error(`${referencePath}.scope`, "scope must be global or local."));
        return;
      }
      if (typeof item.name !== "string" || !isValidNexLabelName(item.name)) {
        diagnostics.push(error(`${referencePath}.name`, "name must be a valid label name."));
        return;
      }
      if (!labelExists(item.scope as NexAnnotationLabelScope, item.name, globalLabels, localLabels)) {
        diagnostics.push(error(referencePath, "Referenced label does not exist."));
        return;
      }
      normalizedReferences.push({
        operandIndex: item.operandIndex,
        scope: item.scope as NexAnnotationLabelScope,
        name: item.name
      });
    });

    if (normalizedReferences.length > 0) {
      references[offsetKey] = normalizedReferences;
    }
  }
  return references;
}

function labelExists(
  scope: NexAnnotationLabelScope,
  name: string,
  globalLabels: NexAnnotationLabel[],
  localLabels: NexAnnotationLabel[]
): boolean {
  const labels = scope === "global" ? globalLabels : localLabels;
  return labels.some((label) => label.name === name);
}

function isBankOffsetKey(value: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(value) && isIntegerInRange(Number(value), 0, NEX_BANK_LAST_OFFSET);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(path: string, message: string): NexAnnotationDiagnostic {
  return { severity: "error", path, message };
}

function warning(path: string, message: string): NexAnnotationDiagnostic {
  return { severity: "warning", path, message };
}
