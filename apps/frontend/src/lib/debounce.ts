export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => unknown,
  delayMs: number
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const debounced = function (...args: TArgs) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = undefined;
  };
  return debounced;
}
