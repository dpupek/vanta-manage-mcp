import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";

const signals = new AsyncLocalStorage<AbortSignal>();
export const withRequestSignal = <T>(signal: AbortSignal, run: () => T): T =>
  signals.run(signal, run);
export const currentRequestSignal = (): AbortSignal | undefined =>
  signals.getStore();

export const configuredRequestTimeout = (): number => {
  const value = Number(process.env.VANTA_REQUEST_TIMEOUT_MS ?? 60000);
  return Number.isFinite(value) && value > 0 && value <= 300000 ? value : 60000;
};

export const abortable = async <T>(
  signal: AbortSignal,
  run: () => Promise<T>,
): Promise<T> => {
  signal.throwIfAborted();
  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => {
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Request cancelled", "AbortError"),
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([run(), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
};

export const withDeadline = async <T>(
  timeoutMs: number,
  parent: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("Request timeout must be positive and finite.");
  parent?.throwIfAborted();
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort(parent?.reason);
  };
  parent?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(
      new DOMException("Vanta request deadline exceeded", "TimeoutError"),
    );
  }, timeoutMs);
  try {
    return await abortable(controller.signal, () => run(controller.signal));
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", onAbort);
  }
};

export const waitForRetry = async (
  ms: number,
  signal: AbortSignal,
): Promise<void> => {
  await delay(Math.min(ms, 2147483647), undefined, { signal });
};

export const retryDelayMs = (
  retryAfter: string | null,
  attempt: number,
  now = Date.now(),
  random = Math.random(),
): number => {
  if (retryAfter !== null && retryAfter.trim() !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    // An invalid numeric value must not be interpreted as an HTTP date.
    if (!/^-?\d/u.test(retryAfter.trim()) || /[a-z]/iu.test(retryAfter)) {
      const date = Date.parse(retryAfter);
      if (Number.isFinite(date)) return Math.max(0, date - now);
    }
  }
  return Math.min(8000, 500 * 2 ** attempt) + Math.floor(random * 250);
};
