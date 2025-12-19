#!/bin/bash
# Smart deploy script with folder-specific restarts and detailed email notifications
# Also suppresses failure emails for transient GitHub fetch/DNS/network issues.

set -Eeuo pipefail

PROJECT_DIR="/home/johan/book-project"
LOG_FILE="/home/johan/deploy.log"
EMAIL="jnel677@gmail.com"
MAIL_CMD="/usr/bin/mail"
BRANCH="main"

HOST="$(hostname -f 2>/dev/null || hostname)"
CURRENT_STEP="initializing"

timestamp() { date '+%Y-%m-%d %H:%M:%S %z'; }
utcstamp() { date -u '+%Y%m%dT%H%M%SZ'; }

send_mail() {
  local subject="$1"
  local body="$2"
  # Never fail the deployment because mail failed
  set +e
  echo -e "$body" | "$MAIL_CMD" -s "$subject" "$EMAIL"
  set -e
  return 0
}

notify_failure() {
  local lineno="${1:-unknown}"
  local cmd="${2:-unknown}"
  local when
  when="$(timestamp)"

  # Avoid recursive traps if something fails inside this handler
  trap - ERR

  local subject="Book Project deploy FAILED [$(utcstamp)] on $HOST"
  local body=""
  body+="Deployment failed on $HOST\n"
  body+="Time: $when\n"
  body+="Step: $CURRENT_STEP\n"
  body+="Failed at line: $lineno\n"
  body+="Command: $cmd\n\n"
  body+="Last 80 log lines:\n"
  body+="$(tail -n 80 "$LOG_FILE" 2>/dev/null || echo '(log file unavailable)')\n"

  send_mail "$subject" "$body"
}

trap 'notify_failure "$LINENO" "$BASH_COMMAND"; exit 1' ERR

echo "[$(timestamp)] Checking for updates..." >> "$LOG_FILE"

cd "$PROJECT_DIR"

CURRENT_STEP="git fetch"

# Retry fetch a few times. If it still fails (often DNS/network), log and exit quietly.
fetch_ok=0
for i in 1 2 3; do
  if git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
    fetch_ok=1
    break
  fi
  echo "[$(timestamp)] WARNING: git fetch failed (attempt $i/3). Retrying in 5s..." >> "$LOG_FILE"
  sleep 5
done

if [ "$fetch_ok" -ne 1 ]; then
  echo "[$(timestamp)] WARNING: git fetch failed after retries (likely DNS/network). Skipping this run (no email)." >> "$LOG_FILE"
  exit 0
fi

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" != "$REMOTE" ]; then
  CURRENT_STEP="preparing deployment"

  DEPLOY_START_EPOCH="$(date +%s)"
  DEPLOY_START_TS="$(timestamp)"
  LOCAL_SHORT="$(git rev-parse --short "$LOCAL")"
  REMOTE_SHORT="$(git rev-parse --short "$REMOTE")"
  DEPLOY_ID="$(utcstamp)-${REMOTE_SHORT}"

  echo "[$(timestamp)] New changes detected: $LOCAL_SHORT -> $REMOTE_SHORT. Deploying..." >> "$LOG_FILE"

  # Determine changed folders/files (non-fatal if diff/stat fails for any reason)
  CHANGED_FOLDERS="$(git diff --name-only "$LOCAL" "$REMOTE" | cut -d/ -f1 | sort -u || true)"
  CHANGED_FILES_COUNT="$(git diff --name-only "$LOCAL" "$REMOTE" | wc -l | tr -d ' ' || echo 0)"
  DIFFSTAT="$(git diff --stat "$LOCAL" "$REMOTE" || true)"

  COMMIT_COUNT="$(git rev-list --count "$LOCAL..$REMOTE" 2>/dev/null || echo "unknown")"
  # True push time isn't available from plain git here; this is the closest practical signal.
  LATEST_COMMIT_TIME="$(git show -s --format=%ci "$REMOTE" 2>/dev/null || echo "unknown")"

  COMMIT_LIST="$(git log --no-merges --date=iso-strict --pretty=format:'- %h | %an | %ad | %s' "$LOCAL..$REMOTE" 2>/dev/null || true)"
  COMMIT_LIST_LIMITED="$(echo "$COMMIT_LIST" | head -n 50)"
  if [ "$COMMIT_LIST" != "$COMMIT_LIST_LIMITED" ]; then
    COMMIT_LIST_LIMITED="$COMMIT_LIST_LIMITED"$'\n'"(commit list truncated to 50 lines)"
  fi

  CURRENT_STEP="git reset to origin"
  git reset --hard "origin/$BRANCH" >> "$LOG_FILE" 2>&1

  ACTIONS_TAKEN=()

  # If api folder changed
  if echo "$CHANGED_FOLDERS" | grep -qx "api"; then
    CURRENT_STEP="api: npm install"
    npm install --production --prefix api >> "$LOG_FILE" 2>&1

    CURRENT_STEP="api: restart systemd service"
    sudo systemctl restart book-api.service >> "$LOG_FILE" 2>&1

    ACTIONS_TAKEN+=("API changed: npm install (production) + restarted book-api.service")
  fi

  # If web folder changed
  if echo "$CHANGED_FOLDERS" | grep -qx "web"; then
    CURRENT_STEP="web: reload nginx"
    sudo systemctl reload nginx >> "$LOG_FILE" 2>&1

    ACTIONS_TAKEN+=("Web changed: reloaded nginx")
  fi

  if [ ${#ACTIONS_TAKEN[@]} -eq 0 ]; then
    ACTIONS_TAKEN+=("No api/ or web/ changes detected: code updated only")
  fi

  DEPLOY_END_TS="$(timestamp)"
  DEPLOY_END_EPOCH="$(date +%s)"
  DURATION="$((DEPLOY_END_EPOCH - DEPLOY_START_EPOCH))"

  echo "[$(timestamp)] Deployment complete. Duration: ${DURATION}s" >> "$LOG_FILE"

  SUBJECT="Book Project deploy SUCCESS [$DEPLOY_ID] on $HOST"
  BODY=""
  BODY+="Deployment succeeded on $HOST\n"
  BODY+="Deploy ID: $DEPLOY_ID\n\n"

  BODY+="Branch: $BRANCH\n"
  BODY+="From: $LOCAL_SHORT ($LOCAL)\n"
  BODY+="To:   $REMOTE_SHORT ($REMOTE)\n\n"

  BODY+="Latest commit time: $LATEST_COMMIT_TIME\n"
  BODY+="Deploy start: $DEPLOY_START_TS\n"
  BODY+="Deploy end:   $DEPLOY_END_TS\n"
  BODY+="Duration: ${DURATION}s\n\n"

  BODY+="Commits deployed: $COMMIT_COUNT\n"
  BODY+="${COMMIT_LIST_LIMITED}\n\n"

  BODY+="Changed files: $CHANGED_FILES_COUNT\n"
  BODY+="Changed top-level folders:\n"
  BODY+="$(echo "$CHANGED_FOLDERS" | sed '/^\s*$/d' | sed 's/^/- /')\n\n"

  BODY+="Diff summary (stat):\n"
  BODY+="$DIFFSTAT\n\n"

  BODY+="Actions taken:\n"
  for a in "${ACTIONS_TAKEN[@]}"; do
    BODY+="- $a\n"
  done

  BODY+="\nLast 50 log lines:\n"
  BODY+="$(tail -n 50 "$LOG_FILE" 2>/dev/null || echo '(log file unavailable)')\n"

  send_mail "$SUBJECT" "$BODY"

else
  echo "[$(timestamp)] No changes detected." >> "$LOG_FILE"
fi