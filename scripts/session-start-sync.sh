#!/bin/sh
# SessionStart sync for this repo. Sessions and sub-agents all start in this one checkout,
# so the sync must be throttled and single-flight, and must never leave a rebase half done.
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
gitdir=$(git rev-parse --git-dir)

# Another operation owns the tree; do nothing.
if [ -d "$gitdir/rebase-merge" ] || [ -d "$gitdir/rebase-apply" ] || [ -f "$gitdir/MERGE_HEAD" ]; then exit 0; fi

# Active edits (another session or a sub-agent): autostash would shuffle files under them.
for f in $(git diff --name-only); do
  if [ -n "$(find "$f" -maxdepth 0 -mmin -2 2>/dev/null)" ]; then exit 0; fi
done

stamp="$gitdir/leonidas-session-sync"
lock="$stamp.lock"
now=$(date +%s)
last=$(cat "$stamp" 2>/dev/null || echo 0)
if [ $((now - last)) -lt 600 ]; then exit 0; fi

# A lock older than 5 minutes belongs to a killed run.
if [ -d "$lock" ] && [ -n "$(find "$lock" -maxdepth 0 -mmin +5 2>/dev/null)" ]; then rmdir "$lock" 2>/dev/null; fi
mkdir "$lock" 2>/dev/null || exit 0
trap 'rmdir "$lock" 2>/dev/null' EXIT
echo "$now" > "$stamp"

# A conflicting rebase is aborted (which restores the autostash) so the next session finds a clean tree.
git pull --rebase --autostash --quiet origin main 2>&1 | tail -n 3
if [ -d "$gitdir/rebase-merge" ] || [ -d "$gitdir/rebase-apply" ]; then
  git rebase --abort >/dev/null 2>&1
  echo "leonidas sync: pull conflicted and was aborted; run git pull --rebase by hand"
fi

pwsh -NoProfile -File scripts/Sync-ProjectTaskViews.ps1 -RepoPath ../.. -Project leonidas-code 2>&1 | tail -n 2
pwsh -NoProfile -File scripts/Install-NextAction.ps1 2>&1 | tail -n 3
exit 0
