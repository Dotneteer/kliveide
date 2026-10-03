#!/usr/bin/env bash

# Exit immediately if any standalone command fails
set -e

MAIN_DIR="$HOME/dev/rtvc"
MASTER_DIR="$HOME/dev/rtvc-master"

# 1. Require a commit message as a parameter
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    echo "❌ Error: A commit message is required."
    echo "Usage: $0 \"your commit message\""
    exit 1
fi

# Move straight into the working directory
cd "$MAIN_DIR"

# 2. Make sure master is not checked out in the working directory
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "master" ]; then
    echo "❌ Error: 'master' is checked out in this directory. Switch to your working branch first."
    exit 1
fi

# 3. Stash staged changes (error if none)
if git diff --cached --quiet; then
    echo "❌ Error: No staged changes found to push to master."
    exit 1
fi

echo "📦 Stashing staged changes..."
git stash push --staged -m "Temp stash for master: $COMMIT_MSG"

# 4. cd ~/dev/rtvc-master
echo "📂 Switching to master worktree..."
cd "$MASTER_DIR"

# 5. Error if there are already stashed changes in the stash list
# (Checks if there are MORE stashes than just the one we literally just created)
STASH_COUNT=$(git stash list | wc -l)
if [ "$STASH_COUNT" -gt 1 ]; then
    echo "❌ Error: There are pre-existing stashes on the stash stack. Clear them before running this script."
    cd "$MAIN_DIR" && git stash pop --index
    exit 1
fi

# 6. git stash pop --index
echo "🔓 Applying staged changes to master..."
git stash pop --index

# 7. git commit -m <commit message>
echo "💾 Committing to master..."
git commit -m "$COMMIT_MSG"

# 8. cd ~/dev/rtvc
echo "📂 Returning to working directory..."
cd "$MAIN_DIR"

# 9. git rebase master
echo "🔄 Rebasing working branch on top of updated master..."
git rebase master

echo "✅ Success! Staged changes committed to master and working branch rebased."
