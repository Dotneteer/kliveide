import type { Statement } from "./source-tree";

// An item of the queue we use for processing a statement
export type StatementQueueItem = {
  // --- The label of the item. We need this information for "break" and "continue" statements
  label: number;

  // --- The description of the statement to execute
  statement: Statement;
};

// The outcome of processing a statement of the queue
export type ProcessOutcome = {
  // --- New statements to unshift into the queue (optional)
  toUnshift?: StatementQueueItem[];

  // --- Label from which statements should be preserved in the queue
  clearToLabel?: number;
};

// --- Implements the statement queue
export class StatementQueue {
  private items: StatementQueueItem[] = [];

  // --- The current queue length
  get length (): number {
    return this.items.length;
  }

  // --- Get the subsequent item in the queue without dequeuing it
  peek (): StatementQueueItem | undefined {
    return this.items[0];
  }

  // --- Remove and return the subsequent item from the queue
  dequeue (): StatementQueueItem | undefined {
    return this.items.shift();
  }

  // --- Push the specified items into the queue and return the corresponding queue items
  push (statements: StatementQueueItem[]): void {
    this.items.push(...statements);
  }

  // --- Unshift the specified items into the queue in reverse order (starting from the last action) and
  // --- return the corresponding queue items
  unshift (statements: StatementQueueItem[]): void {
    this.items.unshift(...statements);
  }

  // --- Remove all items starting from the beginning of the queue, while not reaching the item with the
  // --- specified label. If the label is found, that remains in the queue; otherwise the queue is emptied
  clearToLabel (label: number): void {
    while (this.items.length > 0 && this.items[0].label !== label) {
      this.items.shift();
    }
  }
}

// --- Queue information for test and diagnostics purposes
export type QueueInfo = {
  processedStatements: number;
  maxQueueLength: number;
  unshiftedItems: number;
  clearToLabels: number;
  maxBlocks: number;
  maxLoops: number;
};

// --- The ID of the last used label
let nextLabelValue = 1;

// --- Map a single item to a queue statement list
export function mapToItem (statement: Statement): StatementQueueItem[] {
  return [
    {
      label: nextLabelValue++,
      statement: { ...statement }
    } as StatementQueueItem
  ];
}

// --- Map a single statement into a queue item
export function mapStatementToQueueItem (
  statement: Statement
): StatementQueueItem {
  return {
    label: nextLabelValue++,
    statement: { ...statement }
  };
}

// --- Map a list of statements into queue items
export function mapStatementsToQueueItems (
  statements: Statement[]
): StatementQueueItem[] {
  return statements.map(mapStatementToQueueItem);
}
