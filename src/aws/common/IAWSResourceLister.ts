export interface IAWSResourceLister<T extends {}> {
  fetchNextBatch(): Promise<T[] | undefined>;
  readonly hasMore: boolean;
}
