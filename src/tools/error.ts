export interface ErrorLike {
  message: string;
}
export function assertIsErrorLike(e: unknown): asserts e is ErrorLike {
  if (typeof e === "object" && e !== null && "message" in e) {
    return;
  }

  throw new Error(JSON.stringify(e));
}
