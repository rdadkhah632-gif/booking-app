export class OnboardingResponseError extends Error {}

// Bound session lookup, fetch and response parsing together, including offline hangs.
export async function onboardingRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let cancel: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new Error("Onboarding request interrupted."));
    };
  });
  const timeout = setTimeout(() => cancel(), 30_000);
  parentSignal?.addEventListener("abort", cancel, { once: true });
  if (parentSignal?.aborted) cancel();
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("Request cancelled.");
        return request(controller.signal);
      }),
      cancelled,
    ]);
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", cancel);
  }
}
