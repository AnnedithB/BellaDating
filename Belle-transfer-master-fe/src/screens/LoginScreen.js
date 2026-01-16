import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useAuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { processGoogleAuth } from "../services/socialAuth";

// Complete web browser authentication for Google
WebBrowser.maybeCompleteAuthSession();

// Conditionally import Apple Authentication (only works on iOS)
let AppleAuthentication = null;
if (Platform.OS === 'ios') {
  try {
    AppleAuthentication = require('expo-apple-authentication');
  } catch (e) {
    console.warn('Apple Authentication not available');
  }
}

export default function AuthScreen({ navigation }) {
  const { login, register, isLoading, error, clearError, checkAuthState, updateUser } = useAuth();

  const [isLoginView, setIsLoginView] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [localError, setLocalError] = useState("");
  const [isSocialLoading, setIsSocialLoading] = useState(false);

  // Google OAuth setup
  // For web, use explicit localhost URL to match Google Console configuration
  const redirectUri = Platform.OS === 'web'
    ? 'http://localhost:8081' // Must match exactly what's in Google Console
    : makeRedirectUri({
      scheme: 'appcita',
      path: 'oauth',
    });

  const [googleRequest, googleResponse, googlePromptAsync] = useAuthRequest(
    {
      clientId: Platform.select({
        ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      }),
      redirectUri,
      responseType: Platform.OS === 'web' ? ResponseType.Code : ResponseType.Token,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: Platform.OS === 'web', // Use PKCE for web (required for security)
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token', // Required for automatic token exchange with PKCE
    }
  );

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      console.log('Google OAuth Success Response:', {
        hasAccessToken: !!googleResponse.authentication?.accessToken,
        hasCode: !!googleResponse.params?.code,
        platform: Platform.OS,
        fullResponse: googleResponse,
      });

      if (googleResponse.authentication?.accessToken) {
        // Access token is available (either from token flow or after automatic code exchange)
        handleGoogleAuthSuccess(googleResponse.authentication.accessToken);
      } else if (Platform.OS === 'web' && googleResponse.params?.code) {
        // For web with code flow, manually exchange code for token with PKCE
        handleGoogleCodeExchange(googleResponse.params.code);
      }
    } else if (googleResponse?.type === 'error') {
      setIsSocialLoading(false);
      const errorMsg = googleResponse.error?.message || googleResponse.error?.error_description || googleResponse.error?.error || 'Google Sign-In failed';
      setLocalError(errorMsg);
      console.error('Google OAuth Error:', {
        error: googleResponse.error,
        fullResponse: googleResponse,
      });
    } else if (googleResponse?.type === 'cancel') {
      setIsSocialLoading(false);
    }
  }, [googleResponse]);

  const handleGoogleCodeExchange = async (code) => {
    try {
      // Get code_verifier from the request (needed for PKCE)
      // The code_verifier is stored in the request object when usePKCE is true
      const codeVerifier = googleRequest?.codeVerifier || googleRequest?._codeVerifier;

      console.log('Attempting code exchange:', {
        hasCode: !!code,
        hasCodeVerifier: !!codeVerifier,
        requestKeys: googleRequest ? Object.keys(googleRequest) : 'no request',
      });

      if (!codeVerifier) {
        // Try to get it from localStorage (expo-auth-session stores it there)
        const storedVerifier = localStorage.getItem('expo-auth-session.code-verifier');
        if (storedVerifier) {
          console.log('Found code verifier in localStorage');
          const codeVerifierToUse = storedVerifier;

          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              code: code,
              client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
              code_verifier: codeVerifierToUse,
            }),
          });

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            console.error('Token exchange failed:', errorData);
            throw new Error(errorData.error_description || errorData.error || 'Failed to exchange code for token');
          }

          const tokenData = await tokenResponse.json();
          console.log('Token exchange successful');

          // Clean up stored verifier
          localStorage.removeItem('expo-auth-session.code-verifier');

          if (!tokenData.access_token) {
            throw new Error('No access token in response');
          }

          await handleGoogleAuthSuccess(tokenData.access_token);
          return;
        }

        throw new Error('Code verifier not found. PKCE exchange cannot proceed.');
      }

      console.log('Exchanging authorization code for access token with PKCE...');

      // Exchange authorization code for access token with PKCE
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier, // Required for PKCE
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        console.error('Token exchange failed:', errorData);
        throw new Error(errorData.error_description || errorData.error || 'Failed to exchange code for token');
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

      if (!tokenData.access_token) {
        throw new Error('No access token in response');
      }

      await handleGoogleAuthSuccess(tokenData.access_token);
    } catch (error) {
      console.error('Code exchange error:', error);
      setLocalError(error.message || 'Failed to complete Google Sign-In. Please try again.');
      setIsSocialLoading(false);
    }
  };

  const handleGoogleAuthSuccess = async (accessToken) => {
    try {
      console.log('Processing Google auth with access token...');
      const result = await processGoogleAuth(accessToken);
      console.log('Social login result:', result);

      // Social login already stores token and user in localStorage via authAPI.socialLogin
      // Now update auth context and trigger navigation
      if (result && result.user && result.token) {
        console.log('Social login successful, updating auth context...');

        // Update auth context with user data
        updateUser(result.user);

        // Call checkAuthState to properly set isAuthenticated and trigger navigation
        // This will verify the token and set the authenticated state
        setIsSocialLoading(false);

        // Use a single checkAuthState call - it will set isAuthenticated correctly
        try {
          await checkAuthState();
          console.log('Auth state updated after social login');
        } catch (err) {
          console.error('Error updating auth state after social login:', err);
          // Even if checkAuthState fails, the token is stored, so try once more
          setTimeout(async () => {
            try {
              await checkAuthState();
            } catch (retryErr) {
              console.error('Retry checkAuthState also failed:', retryErr);
              setLocalError('Authentication succeeded but failed to update state. Please refresh the page.');
            }
          }, 500);
        }
      } else {
        console.warn('Social login result missing user or token:', result);
        setIsSocialLoading(false);
        setLocalError('Social login succeeded but no user data received. Please try again.');
      }
    } catch (error) {
      console.error('Google auth success handler error:', error);

      // Handle specific error cases
      if (error.message?.includes('Cannot query field') || error.message?.includes('Unknown type')) {
        setLocalError('Social login is not yet configured on the backend. Please implement the socialLogin GraphQL mutation.');
      } else if (error.message?.includes('User already exists')) {
        setLocalError('An account with this email already exists. Please use email/password login.');
      } else {
        setLocalError(error.message || 'Google Sign-In failed');
      }
      setIsSocialLoading(false);
    }
  };

  const toggleView = () => {
    setIsLoginView(!isLoginView);
    setFullName("");
    setEmail("");
    setPassword("");
    setLocalError("");
    clearError();
  };

  const validateInputs = () => {
    if (!email.trim()) {
      setLocalError("Please enter your email");
      return false;
    }

    if (!email.includes("@")) {
      setLocalError("Please enter a valid email");
      return false;
    }

    if (!password.trim()) {
      setLocalError("Please enter your password");
      return false;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return false;
    }

    if (!isLoginView) {
      if (!agreedToTerms) {
        setLocalError("Please agree to the Terms & Conditions");
        return false;
      }
    }

    setLocalError("");
    return true;
  };

  const handleMainButtonPress = async () => {
    if (!validateInputs()) return;

    if (isLoginView) {
      // Login - navigation is handled automatically by RootNavigator when isAuthenticated becomes true
      const result = await login(email.toLowerCase().trim(), password);

      if (!result.success) {
        setLocalError(result.error);
      }
      // Navigation to Main is handled automatically by RootNavigator
    } else {
      // Register - navigation to EditProfile is handled by RootNavigator
      const result = await register({
        email: email.toLowerCase().trim(),
        password: password,
        name: "New User", // Default string to satisfy backend requirements without user input
      });

      if (!result.success) {
        setLocalError(result.error);
      }
      // Navigation to EditProfile is handled by RootNavigator based on justRegistered flag
    }
  };

  const handleSocialLogin = async (platform) => {
    try {
      setIsSocialLoading(true);
      setLocalError("");

      if (platform === "Google") {
        if (!googleRequest) {
          setLocalError('Google Sign-In is not configured. Please check your environment variables.');
          setIsSocialLoading(false);
          return;
        }

        await googlePromptAsync();
      } else if (platform === "Apple") {
        if (Platform.OS !== 'ios' || !AppleAuthentication) {
          setLocalError('Apple Sign-In is only available on iOS devices.');
          setIsSocialLoading(false);
          return;
        }

        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
          setLocalError('Apple Sign-In is not available on this device.');
          setIsSocialLoading(false);
          return;
        }

        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          if (!credential.identityToken) {
            throw new Error('No identity token received from Apple');
          }

          const email = credential.email || null;
          const name = credential.fullName
            ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
            : null;

          // Send to backend via social login
          const { authAPI } = await import("../services/api");
          const result = await authAPI.socialLogin({
            provider: 'apple',
            idToken: credential.identityToken,
            authorizationCode: credential.authorizationCode,
            email: email,
            name: name,
            appleUserId: credential.user,
          });

          // Social login already stores token and user, refresh auth context
          await checkAuthState();
        } catch (error) {
          if (error.code === 'ERR_REQUEST_CANCELED') {
            // User cancelled - don't show error
            return;
          }
          throw error;
        }
      }
    } catch (error) {
      console.error(`${platform} Sign-In Error:`, error);
      setLocalError(error.message || `${platform} Sign-In failed. Please try again.`);
    } finally {
      setIsSocialLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerIconContainer}>
          <Ionicons name="heart" size={36} color="white" />
        </View>

        <Text style={styles.title}>
          {isLoginView ? "Kyn-Dating & Meeting" : "Create Account"}
        </Text>
        <Text style={styles.subtitle}>
          {isLoginView
            ? "Find your perfect match"
            : "Start your journey to find love"}
        </Text>

        {displayError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        {/* Name field removed as per requirement */
          /*
          {!isLoginView && (
            <>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>
            </>
          )}
          */
          null}

        <Text style={styles.inputLabel}>Email</Text>
        <View style={styles.inputContainer}>
          <Ionicons
            name="mail-outline"
            size={20}
            color="#6B7280"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#6B7280"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.textInput}
            placeholder={
              isLoginView ? "Enter your password" : "Create a password"
            }
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.passwordToggle}
            disabled={isLoading}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {isLoginView ? (
          <TouchableOpacity
            style={styles.forgotPasswordButton}
            disabled={isLoading}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.passwordHint}>At least 8 characters</Text>
        )}

        {!isLoginView && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            disabled={isLoading}
          >
            <View
              style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}
            >
              {agreedToTerms && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text style={styles.linkText}>Terms & Conditions</Text> and{" "}
              <Text style={styles.linkText}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.mainButton, isLoading && styles.mainButtonDisabled]}
          onPress={handleMainButtonPress}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.mainButtonText}>
              {isLoginView ? "Sign In" : "Sign Up"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>or continue with</Text>
        <View style={styles.socialButtonsContainer}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLogin("Google")}
            disabled={isLoading || isSocialLoading}
          >
            {isSocialLoading ? (
              <ActivityIndicator size="small" color="#DB4437" />
            ) : (
              <Ionicons name="logo-google" size={24} color="#DB4437" />
            )}
          </TouchableOpacity>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialLogin("Apple")}
              disabled={isLoading || isSocialLoading}
            >
              {isSocialLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Ionicons name="logo-apple" size={24} color="#000000" />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            {isLoginView
              ? "Don't have an account? "
              : "Already have an account? "}
          </Text>
          <TouchableOpacity onPress={toggleView} disabled={isLoading}>
            <Text style={styles.toggleLink}>
              {isLoginView ? "Sign Up" : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 30 : 0,
    paddingBottom: 40,
    alignItems: "center",
  },
  headerIconContainer: {
    backgroundColor: "#000000",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: "100%",
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  inputLabel: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 50,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  passwordToggle: {
    padding: 5,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: 12,
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
  },
  passwordHint: {
    alignSelf: "flex-start",
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 10,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  termsText: {
    flex: 1,
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 22,
  },
  linkText: {
    color: "#000000",
    fontWeight: "bold",
  },
  mainButton: {
    backgroundColor: "#000000",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  mainButtonDisabled: {
    backgroundColor: "#6B7280",
  },
  mainButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  orText: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 25,
  },
  socialButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "80%",
    marginBottom: 40,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleContainer: {
    flexDirection: "row",
    marginTop: 20,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 15,
    color: "#4B5563",
  },
  toggleLink: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000000",
    marginLeft: 4,
  },
});
