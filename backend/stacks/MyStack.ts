import { StackContext, AppSyncApi, Table } from "sst/constructs";
import { LambdaEnv } from "../lambda/lambdaHelpers";
import { DBQuizKeys, Quiz_distinctTopic_GSI } from "../models/models";
import { RemovalPolicy } from "aws-cdk-lib/core";

export function API({ stack, app }: StackContext) {
  const removalPoligy: RemovalPolicy = app.mode === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;
  const quizTable = new Table(stack, "Quiz", {
    fields: {
      [DBQuizKeys.topic]: "string",
      [DBQuizKeys.title]: "string",
      [DBQuizKeys.dTopic]: "string",
    },
    primaryIndex: { partitionKey: "topic", sortKey: "title" },
  });
  quizTable.addGlobalIndexes({
    [Quiz_distinctTopic_GSI]: {
      partitionKey: DBQuizKeys.dTopic,
      projection: "keys_only",
    },
  });
  quizTable.cdk.table.applyRemovalPolicy(removalPoligy);

  const appSyncApi = new AppSyncApi(stack, "GraphqlApi", {
    schema: "graphql/schema.graphql",
    // specify default function props to be applied to all the Lambda functions
    // attached to the AppSync API
    defaults: {
      function: {
        timeout: 5,
        environment: {
          QUIZ_TABLE_NAME: quizTable.tableName,
          region: stack.region,
        } satisfies LambdaEnv,
      },
    },
    dataSources: {
      topicListDS: "lambda/quizResolver.topicListQuery",
      populateQuizDS: "lambda/quizResolver.populateQuizMutation",
    },
    resolvers: {
      "Query topicList": "topicListDS",
      "Mutation populateQuizData": "populateQuizDS",
    },
  });
  appSyncApi.attachPermissions(["dynamodb"]);

  const output = {
    ApiId: appSyncApi.apiId,
    APiUrl: appSyncApi.url,
    ApiKey: appSyncApi.cdk.graphqlApi.apiKey || "",
  };
  stack.addOutputs(output);
}
