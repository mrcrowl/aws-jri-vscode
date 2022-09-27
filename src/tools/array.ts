export function partition<T>(list: T[], criteria: (item: T) => boolean): [hits: T[], misses: T[]] {
  const hits: T[] = [];
  const misses: T[] = [];
  for (const item of list) {
    if (criteria(item)) {
      hits.push(item);
    } else {
      misses.push(item);
    }
  }
  return [hits, misses];
}
