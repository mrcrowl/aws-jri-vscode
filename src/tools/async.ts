export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: string) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
