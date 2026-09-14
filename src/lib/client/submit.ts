/**
 * Client-side JSON POST for gameplay and sign-in requests.
 *
 * Never throws. A dropped connection, a non-JSON gateway page and a structured
 * API error all come back as a SubmitFailure the screen can render, so no
 * button is ever left stuck on "Working…" and no answer disappears silently.
 *
 * Kept free of React and Zod so it stays in the small browser bundle and can be
 * unit tested in Node.
 */

export type SubmitFailureKind =
  /** fetch itself threw: offline, DNS, connection reset. */
  | 'network'
  /** 5xx, 429, or a response that was not our JSON envelope. Worth retrying. */
  | 'server'
  /** A structured 4xx refusal. Sending the same body again will not help. */
  | 'rejected';

export interface SubmitFailure {
  ok: false;
  kind: SubmitFailureKind;
  code: string;
  message: string;
  ref?: string;
  status?: number;
}

export interface SubmitSuccess<T> {
  ok: true;
  data: T;
}

export type SubmitResult<T> = SubmitSuccess<T> | SubmitFailure;

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the server. Check your connection and try again.";

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  fetchImpl: FetchLike = fetch,
): Promise<SubmitResult<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, kind: 'network', code: 'NETWORK', message: NETWORK_ERROR_MESSAGE };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    // A platform timeout or proxy error page, not our API.
    return {
      ok: false,
      kind: 'server',
      code: 'BAD_RESPONSE',
      message: NETWORK_ERROR_MESSAGE,
      status: res.status,
    };
  }

  const envelope = json as {
    ok?: unknown;
    data?: T;
    error?: { code?: unknown; message?: unknown; ref?: unknown };
  };

  if (envelope?.ok === true) return { ok: true, data: envelope.data as T };

  const transient = res.status >= 500 || res.status === 429;
  const error = envelope?.error;

  return {
    ok: false,
    kind: transient || !error ? 'server' : 'rejected',
    code: typeof error?.code === 'string' ? error.code : 'BAD_RESPONSE',
    message: typeof error?.message === 'string' ? error.message : NETWORK_ERROR_MESSAGE,
    ref: typeof error?.ref === 'string' ? error.ref : undefined,
    status: res.status,
  };
}

export function isRetryable(failure: SubmitFailure): boolean {
  return failure.kind !== 'rejected';
}

/**
 * What to tell a student whose submission did not save. A connection problem
 * gets plain "check your connection" copy; a server message (which may carry a
 * reference code for staff) is shown as the server wrote it.
 */
export function describeSaveFailure(failure: SubmitFailure, thing: string): string {
  if (failure.kind === 'network' || failure.code === 'BAD_RESPONSE') {
    return `We couldn't save your ${thing}. Check your connection and try again.`;
  }
  return failure.message;
}

export interface RetryOptions {
  /** Total tries including the first. */
  maxAttempts?: number;
  /** Wait before each retry; the last value repeats if there are more retries. */
  delaysMs?: number[];
  /** Stop quietly once the screen has moved on. */
  isCancelled?: () => boolean;
  /** Called before each retry, so the screen can say it is reconnecting. */
  onRetry?: (failure: SubmitFailure, nextAttempt: number) => void;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

const sleepFor = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * POSTs the SAME body until the server acknowledges it or the retries run out.
 *
 * The caller builds the body once, idempotency key included, and passes that
 * object to every call — including a manual "Try again" — so a retry is the
 * same logical submission rather than a new one. The server additionally
 * refuses to overwrite a slot that is already answered.
 */
export async function submitWithRetry<T = unknown>(
  url: string,
  body: unknown,
  {
    maxAttempts = 3,
    delaysMs = [800, 2000],
    isCancelled = () => false,
    onRetry,
    fetchImpl,
    sleep = sleepFor,
  }: RetryOptions = {},
): Promise<SubmitResult<T>> {
  let last: SubmitFailure | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await postJson<T>(url, body, fetchImpl);
    if (result.ok || !isRetryable(result)) return result;

    last = result;
    if (attempt === maxAttempts || isCancelled()) break;

    onRetry?.(result, attempt + 1);
    await sleep(delaysMs[Math.min(attempt - 1, delaysMs.length - 1)] ?? 1000);
    if (isCancelled()) break;
  }

  return last as SubmitFailure;
}
