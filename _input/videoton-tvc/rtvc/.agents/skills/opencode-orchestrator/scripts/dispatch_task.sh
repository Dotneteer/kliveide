#!/bin/bash
# scripts/dispatch_task.sh

# Ensure a task file was passed
if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_task_markdown>"
    exit 1
fi
TASK_FILE="$1"

# Verify the file exists
if [ ! -f "$TASK_FILE" ]; then
    echo "Error: Task file $TASK_FILE not found."
    exit 1
fi

echo "🚀 [Codex Orchestrator] Dispatching task to OpenCode..."
echo "Processing: $TASK_FILE"

# Fire the task text directly into the OpenCode CLI using your specialized agent profile
# This triggers OpenCode to handle the logic utilizing DeepSeek V4 Flash
opencode --agent codex-implementer "Please read the following instructions completely and execute the implementation: $(cat "$TASK_FILE")"

# Optional: Move the task to a processing or completed state if OpenCode returns success
if [ $? -eq 0 ]; then
    echo "✅ [Codex Orchestrator] OpenCode completed task successfully."
    mkdir -p .codex/tasks/completed
    mv "$TASK_FILE" .codex/tasks/completed/
else
    echo "❌ [Codex Orchestrator] OpenCode reported an execution error."
    exit 1
fi
