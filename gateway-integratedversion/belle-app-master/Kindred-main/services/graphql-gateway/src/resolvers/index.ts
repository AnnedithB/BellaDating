import { mergeResolvers } from '@graphql-tools/merge';
import { userResolvers } from './userResolvers';
import { sessionResolvers } from './sessionResolvers';
import { messageResolvers } from './messageResolvers';
import { queueResolvers } from './queueResolvers';
import { notificationResolvers } from './notificationResolvers';
import { authResolvers } from './authResolvers';
import { preferencesResolvers } from './preferencesResolvers';
import { GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';

// Scalar resolvers
const scalarResolvers = {
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
};

// Combine all resolvers
export const resolvers: any = mergeResolvers([
  scalarResolvers,
  authResolvers,
  userResolvers,
  sessionResolvers,
  messageResolvers,
  queueResolvers,
  notificationResolvers,
  preferencesResolvers,
]);

export default resolvers;