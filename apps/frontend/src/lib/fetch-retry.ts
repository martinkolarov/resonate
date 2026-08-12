type FetchRetryResult =
  { response: Response; error: null } | { response: Response | null; error: string };

export async function fetchRetry(
  url: string,
  maxAttempts: number,
  options?: RequestInit
): Promise<FetchRetryResult> {
  let response;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await fetch(url, options);
      if (response.ok) {
        return { response, error: null };
      }
      const status = response.status;
      const retryable = status === 408 || status === 429 || status >= 500;
      if (!retryable || attempt === maxAttempts) {
        return { response, error: `Request failed after ${attempt} attempts` };
      }
    } catch {
      if (attempt === maxAttempts) {
        return {
          response: null,
          error: `Request failed after ${attempt} attempts due to a network error`,
        };
      }
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
  return { response: null, error: `Request failed due to network error` };
}
