import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  type User {
    id: ID!
    email: String!
    username: String!
    name: String
    bio: String
    age: Int
    gender: String
    interests: [String!]!
    location: String
    profilePicture: String
    isOnline: Boolean!
    lastSeen: DateTime
    isActive: Boolean!
    isVerified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Query {
    hello: String!
    me: User
  }

  type Mutation {
    login(email: String!, password: String!): String!
  }
`;

export default typeDefs;