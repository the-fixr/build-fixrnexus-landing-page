/**
 * Retry with Exponential Backoff — Phase 1 of Fixr Self-Improvement System
 *
 * Cloudflare Worker safe retry logic with:
 * - Exponential backoff + jitter
 * - Error classification awareness (never retries auth/validation)
 * - Configurable max retries and base delay
 * - Returns retry count for outcome recording
 */

import { classifyError, ErrorClassification, recordOutcome, ActionType, OutcomeEnv } from './outcomes';

export interface RetryResult<T> {
  result?: T;
  error?: unknown;
  retryCount: number;
  classification?: ErrorClassification;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  skill?: string;
}

/**
 * Execute a function with automatic retry on retryable errors.
 *
 * Uses classifyError() to determine if an error is retryable.
 * Applies exponential backoff with jitter.
 * Safe for CF Workers (delays are short, within 30s subrequest budget).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<RetryResult<T>> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelay = opts.baseDelay ?? 1000;
  const maxDelay = opts.maxDelay ?? 15000;

  let lastError: unknown;
  let lastClassification: ErrorClassification | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retryCount: attempt };
    } catch (error) {
      lastError = error;
      lastClassification = classifyError(error);

      // Don't retry non-retryable errors
      if (!lastClassification.isRetryable) {
        return { error, retryCount: attempt, classification: lastClassification };
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        );

        // Use suggested delay from error classification if it's shorter than our calculated delay
        const effectiveDelay = lastClassification.suggestedDelay
          ? Math.min(delay, lastClassification.suggestedDelay)
          : delay;

        console.log(
          `[Retry] Attempt ${attempt + 1}/${maxRetries} failed (${lastClassification.errorClass}), retrying in ${Math.round(effectiveDelay)}ms...`
        );

        await new Promise(resolve => setTimeout(resolve, effectiveDelay));
      }
    }
  }

  return { error: lastError, retryCount: maxRetries, classification: lastClassification };
}

/**
 * Retry + outcome recording in one call.
 * Records success/failure to the outcome ledger with retry count.
 * Returns the result or throws on final failure.
 */
export async function withRetryAndOutcome<T>(
  env: OutcomeEnv,
  meta: {
    actionType: ActionType;
    actionId?: string;
    skill: string;
    context?: Record<string, unknown>;
  },
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<{ result: T; retryCount: number }> {
  const start = Date.now();
  const retryResult = await withRetry(fn, opts);

  if (retryResult.result !== undefined) {
    recordOutcome(env, {
      action_type: meta.actionType,
      action_id: meta.actionId,
      skill: meta.skill,
      success: true,
      context: meta.context,
      outcome: typeof retryResult.result === 'object' && retryResult.result !== null
        ? retryResult.result as Record<string, unknown>
        : { value: retryResult.result },
      duration_ms: Date.now() - start,
      retry_count: retryResult.retryCount,
    }).catch(() => {});
    return { result: retryResult.result, retryCount: retryResult.retryCount };
  }

  // Failed after all retries
  const classification = retryResult.classification || classifyError(retryResult.error);
  recordOutcome(env, {
    action_type: meta.actionType,
    action_id: meta.actionId,
    skill: meta.skill,
    success: false,
    error_class: classification.errorClass,
    error_message: String(retryResult.error).slice(0, 2000),
    context: meta.context,
    duration_ms: Date.now() - start,
    retry_count: retryResult.retryCount,
  }).catch(() => {});
  throw retryResult.error;
}
