import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../components";
import { Ionicons } from "@expo/vector-icons";
import { userAPI } from "../services/api";
// -----------------

const ACCENT_COLOR = "#000000";
const LIGHT_GRAY = "#E5E7EB";
const MEDIUM_GRAY = "#6B7280";
const DIVIDER_COLOR = "#f3f4f6";
const DISABLED_TEXT_COLOR = "#9CA3AF";

export default function NotificationSettingsScreen({ navigation }) {
  // --- State for Toggles ---
  const [globalToggle, setGlobalToggle] = useState(true);
  const [newMatches, setNewMatches] = useState(true);
  const [newMessages, setNewMessages] = useState(true);
  const [appPromotions, setAppPromotions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    userAPI
      .getNotificationSettings()
      .then((settings) => {
        if (isMounted && settings) {
          // Handle both boolean and undefined/null values properly
          setGlobalToggle(settings.all !== undefined ? settings.all : true);
          setNewMatches(settings.newMatches !== undefined ? settings.newMatches : true);
          setNewMessages(settings.newMessages !== undefined ? settings.newMessages : true);
          setAppPromotions(settings.appPromotions !== undefined ? settings.appPromotions : false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load notification settings:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // --- Handlers ---
  // When the global toggle is flipped, update all other toggles
  const handleGlobalToggle = (value) => {
    setGlobalToggle(value);
    setNewMatches(value);
    setNewMessages(value);
    setAppPromotions(value);

    userAPI
      .updateNotificationSettings({
        all: value,
        newMatches: value,
        newMessages: value,
        appPromotions: value,
      })
      .catch((err) => {
        console.warn("Failed to update notification settings:", err);
      });
  };

  // Individual toggle handlers
  const handleNewMatchesToggle = (value) => {
    setNewMatches(value);
    userAPI
      .updateNotificationSettings({
        all: globalToggle,
        newMatches: value,
        newMessages,
        appPromotions,
      })
      .catch((err) => {
        console.warn("Failed to update new matches setting:", err);
      });
  };

  const handleNewMessagesToggle = (value) => {
    setNewMessages(value);
    userAPI
      .updateNotificationSettings({
        all: globalToggle,
        newMatches,
        newMessages: value,
        appPromotions,
      })
      .catch((err) => {
        console.warn("Failed to update new messages setting:", err);
      });
  };

  const handleAppPromotionsToggle = (value) => {
    setAppPromotions(value);
    userAPI
      .updateNotificationSettings({
        all: globalToggle,
        newMatches,
        newMessages,
        appPromotions: value,
      })
      .catch((err) => {
        console.warn("Failed to update promotions setting:", err);
      });
  };

  const renderToggleOption = ({
    title,
    subtitle,
    value,
    onValueChange,
    iconName,
    disabled = false,
  }) => {
    const textStyle = disabled ? styles.disabledText : null;

    return (
      <View style={styles.toggleRow}>
        <Ionicons
          name={iconName}
          size={24}
          color={disabled ? DISABLED_TEXT_COLOR : ACCENT_COLOR}
          style={styles.leftIcon}
        />
        <View style={styles.toggleTextContainer}>
          <Text style={[styles.toggleTitle, textStyle]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.toggleSubtitle, textStyle]}>{subtitle}</Text>
          )}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: LIGHT_GRAY, true: ACCENT_COLOR }}
          thumbColor={"#ffffff"}
          ios_backgroundColor={LIGHT_GRAY}
          disabled={disabled}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* --- Header --- */}
      <ScreenHeader title="Notifications" navigation={navigation} showBack={true}/>

      {/* --- Scrollable Content --- */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.contentContainer}>
          {/* --- Global Toggle --- */}
          {renderToggleOption({
            title: "Pause All Notifications",
            subtitle: "Temporarily stop all push notifications.",
            value: globalToggle,
            onValueChange: handleGlobalToggle,
            iconName: globalToggle
              ? "notifications-outline"
              : "notifications-off-outline",
          })}

          <View style={styles.divider} />

          {/* --- Categorized Toggles --- */}
          <Text style={styles.sectionTitle}>Manage Notifications</Text>

          {renderToggleOption({
            title: "New Matches",
            value: newMatches,
            onValueChange: handleNewMatchesToggle,
            iconName: "heart-outline",
            disabled: !globalToggle,
          })}

          {renderToggleOption({
            title: "New Messages",
            value: newMessages,
            onValueChange: handleNewMessagesToggle,
            iconName: "chatbubble-outline",
            disabled: !globalToggle,
          })}

          {renderToggleOption({
            title: "App Promotions",
            value: appPromotions,
            onValueChange: handleAppPromotionsToggle,
            iconName: "megaphone-outline",
            disabled: !globalToggle,
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: MEDIUM_GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER_COLOR,
    marginVertical: 24,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  leftIcon: {
    marginRight: 16,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: MEDIUM_GRAY,
    lineHeight: 20,
  },
  disabledText: {
    color: DISABLED_TEXT_COLOR,
  },
});
