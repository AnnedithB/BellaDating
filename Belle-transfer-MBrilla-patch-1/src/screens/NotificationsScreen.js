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

const MOCK_SETTINGS = {
  globalToggle: true,
  newMatches: true,
  newMessages: true,
  appPromotions: false,
};
// -----------------

const ACCENT_COLOR = "#000000";
const LIGHT_GRAY = "#E5E7EB";
const MEDIUM_GRAY = "#6B7280";
const DIVIDER_COLOR = "#f3f4f6";
const DISABLED_TEXT_COLOR = "#9CA3AF";

export default function NotificationSettingsScreen({ navigation }) {
  // --- State for Toggles ---
  const [globalToggle, setGlobalToggle] = useState(MOCK_SETTINGS.globalToggle);
  const [newMatches, setNewMatches] = useState(MOCK_SETTINGS.newMatches);
  const [newMessages, setNewMessages] = useState(MOCK_SETTINGS.newMessages);
  const [appPromotions, setAppPromotions] = useState(
    MOCK_SETTINGS.appPromotions
  );

  // --- Handlers ---
  // When the global toggle is flipped, update all other toggles
  const handleGlobalToggle = (value) => {
    setGlobalToggle(value);
    setNewMatches(value);
    setNewMessages(value);
    setAppPromotions(value);

    // api.updateAllNotificationSettings({ enabled: value });
    console.log("Set ALL notifications to:", value);
  };

  // Individual toggle handlers
  const handleNewMatchesToggle = (value) => {
    setNewMatches(value);
    // api.updateNotificationSetting({ newMatches: value });
    console.log("Set new matches notifications to:", value);
  };

  const handleNewMessagesToggle = (value) => {
    setNewMessages(value);
    // api.updateNotificationSetting({ newMessages: value });
    console.log("Set new messages notifications to:", value);
  };

  const handleAppPromotionsToggle = (value) => {
    setAppPromotions(value);
    // api.updateNotificationSetting({ appPromotions: value });
    console.log("Set app promotions notifications to:", value);
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
