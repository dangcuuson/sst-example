import type { AppSyncResolverHandler } from "aws-lambda";
import {
  LambdaEnv,
  WriteRequest,
  batchWriteInChunks,
  getDDBDocClient,
} from "./lambdaHelpers";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GQLQuery } from "../graphql/types";
import { DBQuiz, DBQuizKeys, Quiz_distinctTopic_GSI } from "../models/models";
import _uniq from "lodash/uniq";
import { HSCQuizzes } from "./sampleQuizData";

type TopicListResult = GQLQuery["topicList"];
type TopicListArgs = never;

export const topicListQuery: AppSyncResolverHandler<
  TopicListArgs,
  TopicListResult
> = async (event) => {
  const env = process.env as LambdaEnv;
  const db = getDDBDocClient({ region: env.region });
  const result = await db.send(
    new ScanCommand({
      TableName: env.QUIZ_TABLE_NAME,
      IndexName: Quiz_distinctTopic_GSI,
    })
  );

  return _uniq(
    (result.Items || []).map((i) => i[DBQuizKeys.dTopic] + "").sort()
  );
};

export const populateQuizMutation = async () => {
  const env = process.env as LambdaEnv;
  const db = getDDBDocClient({ region: env.region });

  const scanResult = await db.send(
    new ScanCommand({
      TableName: env.QUIZ_TABLE_NAME,
      Limit: 1,
    })
  );

  // do not populate if there's data already
  if ((scanResult.Count || 0) > 0) {
    return 0;
  }

  let currentTopic = "";
  const writeRequests = HSCQuizzes.map((quiz) => {
    const setDTopic = currentTopic !== quiz.topic;
    currentTopic = quiz.topic;
    const dbQuiz: DBQuiz = {
      ...quiz,
      quizCode: `${quiz.topic}#${quiz.title}`,
      dTopic: setDTopic ? quiz.topic : undefined,
    };
    const req: WriteRequest = {
      PutRequest: {
        Item: dbQuiz,
      },
    };
    return req;
  });

  await batchWriteInChunks({
    tableName: env.QUIZ_TABLE_NAME,
    db,
    writeRequests,
  });
  return HSCQuizzes.length;
};
