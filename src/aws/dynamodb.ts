import * as dynamodb from "@aws-sdk/client-dynamodb";
import { makeResourceLoader } from "./common/loader";

export const getTables = makeResourceLoader<dynamodb.DynamoDBClient, string>({
  init({ region }) {
    return new dynamodb.DynamoDBClient({ region });
  },
  async *enumerate(client) {
    let marker: string | undefined;
    do {
      const response = await client.send(
        new dynamodb.ListTablesCommand({ ExclusiveStartTableName: marker })
      );
      yield* response.TableNames ?? [];
      marker = response.LastEvaluatedTableName;
    } while (marker);
  },
  map(tableName: string, region: string) {
    return {
      name: tableName,
      description: "",
      url: `https://${region}.console.aws.amazon.com/dynamodbv2/home?region=${region}#item-explorer?initialTagKey=&maximize=true&table=${tableName}`,
    };
  },
});
