import * as s3 from '@aws-sdk/client-s3';
import { makeResourceLoader } from './common/loader';

export const getBuckets = makeResourceLoader<s3.S3Client, s3.Bucket>({
  init: ({ region }) => new s3.S3Client({ region }),

  async *enumerate(client) {
    const response = await client.send(new s3.ListBucketsCommand({}));
    yield* response.Buckets ?? [];
  },

  map(bucket, region) {
    return {
      name: bucket.Name ?? 'Unknown',
      description: '',
      url: `https://s3.console.aws.amazon.com/s3/buckets/${bucket?.Name}?region=${region}&tab=objects`,
    };
  },
});
