import React, { useState } from "react";
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

export default function AuthScreen({ navigation }) {
  const { login, register, isLoading, error, clearError } = useAuth();

  const [isLoginView, setIsLoginView] = useState(true);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [localError, setLocalError] = useState("");

  const toggleView = () => {
    setIsLoginView(!isLoginView);
    setFullName("");
    setUsername("");
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
      if (!username.trim()) {
        setLocalError("Please enter a username");
        return false;
      }

      if (username.length < 3) {
        setLocalError("Username must be at least 3 characters");
        return false;
      }

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
      // Login
      const result = await login(email.toLowerCase().trim(), password);

      if (!result.success) {
        setLocalError(result.error);
      }
      // If success, AuthContext will update isAuthenticated and navigation will happen automatically
    } else {
      // Register
      const result = await register({
        email: email.toLowerCase().trim(),
        username: username.trim(),
        password: password,
        name: fullName.trim() || undefined,
      });

      if (!result.success) {
        setLocalError(result.error);
      }
      // If success, AuthContext will update isAuthenticated and navigation will happen automatically
    }
  };

  const handleSocialLogin = (platform) => {
    Alert.alert(
      "Coming Soon",
      `${platform} login will be available soon!`,
      [{ text: "OK" }]
    );
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
          {isLoginView ? "AppCita" : "Create Account"}
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

            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="at-outline"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Choose a username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </>
        )}

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
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={24} color="#DB4437" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLogin("Apple")}
            disabled={isLoading}
          >
            <Ionicons name="logo-apple" size={24} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLogin("Facebook")}
            disabled={isLoading}
          >
            <Ionicons name="logo-facebook" size={24} color="#4267B2" />
          </TouchableOpacity>
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
