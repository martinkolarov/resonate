type Fn<TArgs extends unknown[], TResult> = (
  ...args: [...TArgs, (error: Error | null, result: TResult) => void]
) => void;

export function promisify<TArgs extends unknown[], TResult>(fn: Fn<TArgs, TResult>) {
  return function (...args: TArgs): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      fn(...args, (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      });
    });
  };
}
