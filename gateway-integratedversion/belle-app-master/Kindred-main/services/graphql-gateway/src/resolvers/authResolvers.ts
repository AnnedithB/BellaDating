import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';
import axios from 'axios';
import { config } from '../config';
import { generateToken } from '../auth';

export const authResolvers = {
  Mutation: {
    register: async (
      _: any,
      { input }: { input: { email: string; username: string; password: string; name?: string; age?: number; gender?: string; interests?: string[]; location?: string } },
      context: GraphQLContext
    ) => {
      try {
        const response = await axios.post(`${config.services.user}/auth/register`, {
          email: input.email,
          username: input.username,
          password: input.password,
        });

        const { user, token } = response.data.data;

        // If name was provided during registration, create/update the profile
        if (input.name) {
          try {
            await axios.put(
              `${config.services.user}/profile`,
              {
                displayName: input.name,
                age: input.age,
                gender: input.gender,
                locationCity: input.location,
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );
          } catch (profileError) {
            // Log but don't fail registration if profile update fails
            console.error('Failed to create profile during registration:', profileError);
          }
        }

        return {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: input.name || '',
            bio: '',
            age: input.age || null,
            gender: input.gender || null,
            interests: input.interests || [],
            location: input.location || null,
            profilePicture: null,
            isOnline: true,
            lastSeen: new Date(),
            isActive: true,
            isVerified: false,
            createdAt: user.createdAt,
            updatedAt: user.createdAt,
          },
          expiresIn: '7d',
        };
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Registration failed';
        throw new GraphQLError(message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    },

    login: async (
      _: any,
      { email, password }: { email: string; password: string },
      context: GraphQLContext
    ) => {
      try {
        const response = await axios.post(`${config.services.user}/auth/login`, {
          email,
          password,
        });

        const { user, token } = response.data.data;

        return {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name || '',
            bio: user.bio || '',
            age: user.age || null,
            gender: user.gender || null,
            interests: user.interests || [],
            location: user.location || null,
            profilePicture: user.profilePicture || null,
            isOnline: true,
            lastSeen: new Date(),
            isActive: true,
            isVerified: user.isVerified || false,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt || user.createdAt,
          },
          expiresIn: '7d',
        };
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Login failed';
        throw new GraphQLError(message, {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
    },

    logout: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        await axios.post(
          `${config.services.user}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${context.auth.token}`,
            },
          }
        );
        return true;
      } catch (error: any) {
        // Even if logout fails on backend, we return true for client-side logout
        return true;
      }
    },

    refreshToken: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Generate a new token with the current user info
      const newToken = generateToken(context.auth.user);

      return {
        token: newToken,
        user: context.auth.user,
        expiresIn: '7d',
      };
    },

    forgotPassword: async (
      _: any,
      { email }: { email: string },
      context: GraphQLContext
    ) => {
      try {
        const response = await axios.post(`${config.services.user}/auth/forgot-password`, {
          email,
        });

        return {
          success: true,
          message: response.data.data?.message || 'If your email is registered, you will receive a password reset link.',
        };
      } catch (error: any) {
        // Always return success to prevent email enumeration
        return {
          success: true,
          message: 'If your email is registered, you will receive a password reset link.',
        };
      }
    },

    resetPassword: async (
      _: any,
      { token, password }: { token: string; password: string },
      context: GraphQLContext
    ) => {
      try {
        if (!password || password.length < 8) {
          throw new GraphQLError('Password must be at least 8 characters', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        const response = await axios.post(`${config.services.user}/auth/reset-password`, {
          token,
          password,
        });

        return {
          success: true,
          message: response.data.data?.message || 'Password reset successfully. Please log in with your new password.',
        };
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || 'Password reset failed';
        throw new GraphQLError(message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    },
  },
};
