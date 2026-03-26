# Deploy Webhook

The API exposes a GitHub webhook endpoint at:

- `/internal/deploy/github-webhook`

It is intended for GitHub push deliveries and triggers the existing `deploy.sh` workflow asynchronously.

The webhook no longer runs `deploy.sh` as a child of the API process. Instead, it asks systemd to start a dedicated oneshot deploy service so the deploy can continue even when `deploy.sh` restarts `book-api.service`.

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
- `DEPLOY_SERVICE_NAME`
  Optional. Defaults to `book-project-deploy.service`.
- `DEPLOY_WEBHOOK_ENABLED`
  Optional. If omitted, webhook handling is enabled automatically when `GITHUB_WEBHOOK_SECRET` is configured.

## How deploy triggering works

When a signed push-to-main webhook is received:

1. The API verifies the raw-body HMAC signature.
2. It checks that the event is `push`.
3. It checks that `payload.ref === "refs/heads/main"`.
4. It asks systemd to start `book-project-deploy.service` with `systemctl start --no-block`.
5. systemd runs `/home/johan/book-project/deploy.sh` independently of `book-api.service`.

The HTTP request does not wait for deployment to finish, and deploy output is not streamed back to GitHub. The existing deploy script keeps writing to its normal deploy log and keeps the existing TypeORM migration-on-deploy behavior intact.

## Overlapping deploy protection

The route checks the state of the separate deploy service before requesting another run:

- Service checked:
  - `book-project-deploy.service`
- If the deploy service is already `active` or `activating`, another webhook delivery will not start a second deploy.
- The API returns `202` with a message indicating a deploy is already in progress.

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
- The webhook requests systemd to start `book-project-deploy.service`, which then runs `/home/johan/book-project/deploy.sh`.
- This separation prevents webhook-triggered deploys from being interrupted when `deploy.sh` restarts `book-api.service`.
- `deploy.sh` still restarts `book-api.service` via `sudo systemctl restart book-api.service`, so user `johan` must still be allowed to run that restart command non-interactively.
- The API process also needs non-interactive permission to ask systemd to start and inspect `book-project-deploy.service`.

## Manual Pi installation steps

1. Copy the service file into systemd:
   - `sudo cp /home/johan/book-project/deploy/book-project-deploy.service /etc/systemd/system/book-project-deploy.service`
2. Reload systemd:
   - `sudo systemctl daemon-reload`
3. Verify the unit file:
   - `sudo systemctl cat book-project-deploy.service`
4. Restart the API after updating its environment:
   - `sudo systemctl restart book-api.service`

You do not need to enable the deploy service permanently. The webhook starts it on demand.

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
