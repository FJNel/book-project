# Deploy Webhook

The API exposes a GitHub webhook endpoint at:

- `/internal/deploy/github-webhook`

It is intended for GitHub push deliveries and triggers the existing `deploy.sh` workflow asynchronously.

## Security

The endpoint validates GitHub's `X-Hub-Signature-256` header using HMAC SHA-256 and the raw request body exactly as GitHub sent it.

- Requests without a valid signature are rejected.
- Only the `push` event is considered.
- Only pushes to `refs/heads/main` trigger deployment.
- Other events and branches are acknowledged with a normal success response and ignored.

## Required environment variables

- `GITHUB_WEBHOOK_SECRET`
  Shared secret configured in GitHub and on the server.
- `DEPLOY_SCRIPT_PATH`
  Optional. Defaults to `/home/johan/book-project/deploy.sh`.
- `DEPLOY_WORKING_DIRECTORY`
  Optional. Defaults to `/home/johan/book-project`.
- `DEPLOY_LOCK_FILE_PATH`
  Optional. Defaults to `/home/johan/book-project/.deploy-webhook.lock`.
- `DEPLOY_WEBHOOK_ENABLED`
  Optional. If omitted, webhook handling is enabled automatically when `GITHUB_WEBHOOK_SECRET` is configured.

## How deploy triggering works

When a signed push-to-main webhook is received:

1. The API verifies the raw-body HMAC signature.
2. It checks that the event is `push`.
3. It checks that `payload.ref === "refs/heads/main"`.
4. It starts `deploy.sh` with `spawn()` and returns immediately.

The HTTP request does not wait for deployment to finish, and deploy output is not streamed back to GitHub. The existing deploy script keeps writing to its normal deploy log and keeps the existing TypeORM migration-on-deploy behavior intact.

## Overlapping deploy protection

The route uses a lock file so concurrent webhook deliveries do not start overlapping deploys:

- Default lock file:
  - `/home/johan/book-project/.deploy-webhook.lock`
- If `deploy.sh` is already running, another webhook delivery will not start a second deploy.
- The API returns `202` with a message indicating a deploy is already in progress.
- The lock stores the deploy child PID and is released when the child exits or errors.
- If a stale lock file exists but its PID is no longer running, the API clears it and continues.

## GitHub webhook setup

In the GitHub repository settings:

1. Go to `Settings -> Webhooks`.
2. Add a webhook.
3. Set the payload URL to your API endpoint:
   - `https://your-api-host/internal/deploy/github-webhook`
4. Set the content type to:
   - `application/json`
5. Set the secret to the same value as `GITHUB_WEBHOOK_SECRET`.
6. Choose:
   - `Just the push event`
7. Save the webhook.

## Operational notes

- The API runs under systemd as user `johan`.
- `book-api.service` uses:
  - `WorkingDirectory=/home/johan/book-project/api`
  - `ExecStart=/usr/bin/node index.js`
- The webhook starts `/home/johan/book-project/deploy.sh`, which keeps the existing migration check and service restart flow intact.
- Because `deploy.sh` restarts `book-api.service` via `sudo systemctl restart book-api.service`, user `johan` must be allowed to run that restart command non-interactively on the server.

## Testing

Use GitHub's webhook delivery UI:

1. Open the webhook in repository settings.
2. Use `Recent Deliveries`.
3. Redeliver a known `push` event.
4. Check:
   - the webhook response body in GitHub
   - the API logs for webhook validation/start events
   - the deploy log used by `deploy.sh`

If you send a push event for a branch other than `main`, the API should respond successfully but indicate that the event was ignored.
