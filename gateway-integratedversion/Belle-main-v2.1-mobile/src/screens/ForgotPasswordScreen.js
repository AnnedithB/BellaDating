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
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authAPI } from "../services/api";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // For reset password step
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validateEmail = () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return false;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return false;
    }

    setError("");
    return true;
  };

  const validateResetForm = () => {
    if (!resetToken.trim()) {
      setError("Please enter the reset token from your email");
      return false;
    }

    if (!newPassword.trim()) {
      setError("Please enter a new password");
      return false;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    setError("");
    return true;
  };

  const handleForgotPassword = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await authAPI.forgotPassword(email.toLowerCase().trim());
      setIsSubmitted(true);
      Alert.alert(
        "Check Your Email",
        result.message || "If your email is registered, you will receive a password reset link.",
        [{ text: "OK" }]
      );
    } catch (err) {
      // Still show success to prevent email enumeration
      setIsSubmitted(true);
      Alert.alert(
        "Check Your Email",
        "If your email is registered, you will receive a password reset link.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validateResetForm()) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await authAPI.resetPassword(resetToken.trim(), newPassword);
      Alert.alert(
        "Password Reset Successful",
        result.message || "Your password has been reset. Please log in with your new password.",
        [
          {
            text: "Go to Login",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderForgotPasswordForm = () => (
    <>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        Enter your email address and we'll send you a link to reset your password.
      </Text>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

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

      <TouchableOpacity
        style={[styles.mainButton, isLoading && styles.mainButtonDisabled]}
        onPress={handleForgotPassword}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.mainButtonText}>Send Reset Link</Text>
        )}
      </TouchableOpacity>

      {isSubmitted && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowResetForm(true)}
        >
          <Text style={styles.secondaryButtonText}>I have a reset token</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const renderResetPasswordForm = () => (
    <>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter the reset token from your email and create a new password.
      </Text>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.inputLabel}>Reset Token</Text>
      <View style={styles.inputContainer}>
        <Ionicons
          name="key-outline"
          size={20}
          color="#6B7280"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.textInput}
          placeholder="Paste token from email"
          value={resetToken}
          onChangeText={setResetToken}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />
      </View>

      <Text style={styles.inputLabel}>New Password</Text>
      <View style={styles.inputContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color="#6B7280"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.textInput}
          placeholder="Enter new password"
          value={newPassword}
          onChangeText={setNewPassword}
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

      <Text style={styles.inputLabel}>Confirm Password</Text>
      <View style={styles.inputContainer}>
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color="#6B7280"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.textInput}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!isLoading}
        />
      </View>

      <Text style={styles.passwordHint}>At least 8 characters</Text>

      <TouchableOpacity
        style={[styles.mainButton, isLoading && styles.mainButtonDisabled]}
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.mainButtonText}>Reset Password</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          setShowResetForm(false);
          setError("");
        }}
      >
        <Text style={styles.secondaryButtonText}>Back to email form</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerIconContainer}>
          <Ionicons name="lock-open" size={36} color="white" />
        </View>

        {showResetForm ? renderResetPasswordForm() : renderForgotPasswordForm()}

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>Remember your password? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={isLoading}>
            <Text style={styles.toggleLink}>Sign In</Text>
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
  backButton: {
    alignSelf: "flex-start",
    padding: 8,
    marginBottom: 10,
  },
  headerIconContainer: {
    backgroundColor: "#000000",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
    paddingHorizontal: 20,
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
  passwordHint: {
    alignSelf: "flex-start",
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 10,
  },
  mainButton: {
    backgroundColor: "#000000",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 20,
  },
  mainButtonDisabled: {
    backgroundColor: "#6B7280",
  },
  mainButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  secondaryButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  toggleContainer: {
    flexDirection: "row",
    marginTop: 30,
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
