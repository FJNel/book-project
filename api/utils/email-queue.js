// Lightweight in-memory email queue with retry + backoff (non-blocking)
const { v4: uuidv4 } = require('uuid');
const { logToFile } = require('./logging');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordResetSuccessEmail,
} = require('./email');

const config = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  concurrency: 1,
};

const queue = [];
let active = 0;

function enqueueEmail({ type, params = {}, context = null, userId = null }) {
  const job = {
    id: uuidv4(),
    type,
    params,
    context,
    userId,
    attempt: 0,
  };

  queue.push(job);
  logToFile('EMAIL_QUEUE', { status: 'INFO', action: 'ENQUEUED', job_id: job.id, type, user_id: userId, details: { context } }, 'info');
  processQueue();
}

async function processQueue() {
  if (active >= config.concurrency) return;
  const job = queue.shift();
  if (!job) return;

  active += 1;
  try {
    await runJob(job);
    logToFile('EMAIL_SEND', { status: 'SUCCESS', job_id: job.id, type: job.type, user_id: job.userId, details: { context: job.context } }, 'info');
  } catch (e) {
    job.attempt += 1;
    if (job.attempt <= config.maxRetries) {
      const delay = config.initialDelayMs * Math.pow(config.backoffFactor, job.attempt - 1);
      logToFile('EMAIL_SEND', { status: 'FAILURE', job_id: job.id, type: job.type, user_id: job.userId, error_message: e.message, details: { context: job.context, attempt: job.attempt, retry_in_ms: delay } }, 'warn');
      setTimeout(() => {
        queue.push(job);
        processQueue();
      }, delay);
    } else {
      logToFile('EMAIL_SEND', { status: 'FAILURE', job_id: job.id, type: job.type, user_id: job.userId, error_message: e.message, details: { context: job.context, terminal: true } }, 'error');
    }
  } finally {
    active -= 1;
    // Continue with next job if available
    if (queue.length > 0) processQueue();
  }
}

async function runJob(job) {
  const { type, params } = job;
  switch (type) {
    case 'verification':
      // params: toEmail, token, preferredName, expiresIn
      return sendVerificationEmail(params.toEmail, params.token, params.preferredName, params.expiresIn);
    case 'password_reset':
      // params: toEmail, token, preferredName, expiresIn
      return sendPasswordResetEmail(params.toEmail, params.token, params.preferredName, params.expiresIn);
    case 'welcome':
      // params: toEmail, preferredName
      return sendWelcomeEmail(params.toEmail, params.preferredName);
    case 'password_reset_success':
      // params: toEmail, preferredName
      return sendPasswordResetSuccessEmail(params.toEmail, params.preferredName);
    default:
      throw new Error(`Unknown email job type: ${type}`);
  }
}

module.exports = { enqueueEmail };

