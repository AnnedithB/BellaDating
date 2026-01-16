import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { authAPI } from './api';

/**
 * Process Google authentication result and send to backend
 */
export const processGoogleAuth = async (accessToken) => {
  try {
    if (!accessToken) {
      throw new Error('No access token received from Google');
    }

    // Get user info from Google
    const userInfoResponse = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
    );

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const googleUser = await userInfoResponse.json();

    // Send to backend for authentication/registration
    const backendResponse = await authAPI.socialLogin({
      provider: 'google',
      accessToken: accessToken,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      googleId: googleUser.id,
    });

    return backendResponse;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

/**
 * Apple Sign-In
 * Returns user data from Apple or throws an error
 */
export const signInWithApple = async () => {
  try {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS devices');
    }

    // Check if Apple Authentication is available
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Sign-In is not available on this device');
    }

    // Request Apple authentication
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('No identity token received from Apple');
    }

    // Extract user info from credential
    const email = credential.email || null;
    const name = credential.fullName
      ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
      : null;

    // Send to backend for authentication/registration
    const backendResponse = await authAPI.socialLogin({
      provider: 'apple',
      idToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      email: email,
      name: name,
      appleUserId: credential.user,
    });

    return backendResponse;
  } catch (error) {
    // Handle user cancellation gracefully
    if (error.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Apple Sign-In was cancelled');
    }
    console.error('Apple Sign-In Error:', error);
    throw error;
  }
};

