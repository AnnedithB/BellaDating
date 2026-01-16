import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../components";
import { Ionicons } from "@expo/vector-icons";

const MOCK_SETTINGS = {
  showOnlineStatus: true,
  sendReadReceipts: true,
};

const ACCENT_COLOR = "#000000";
const LIGHT_GRAY = "#E5E7EB";
const MEDIUM_GRAY = "#6B7280";
const DIVIDER_COLOR = "#f3f4f6";

export default function PrivacySafetyScreen({ navigation }) {
  // --- State for Toggles ---
  const [showOnlineStatus, setShowOnlineStatus] = useState(
    MOCK_SETTINGS.showOnlineStatus
  );
  const [sendReadReceipts, setSendReadReceipts] = useState(
    MOCK_SETTINGS.sendReadReceipts
  );

  // --- Handlers for Toggles (would call backend) ---
  const toggleOnlineStatus = (value) => {
    setShowOnlineStatus(value);
    console.log("Set show online status to:", value);
  };

  const toggleReadReceipts = (value) => {
    setSendReadReceipts(value);
    console.log("Set send read receipts to:", value);
  };

  // --- Handlers for Navigation ---
  const handleBlockedUsers = () => {
    console.log("Navigate to Blocked Users");
    // navigation.navigate('BlockedUsers');
    Alert.alert("Navigate", "This will open the Blocked Users screen.");
  };

  const handleReportHistory = () => {
    console.log("Navigate to Report History");
    // navigation.navigate('ReportHistory');
    Alert.alert("Navigate", "This will open the Report History screen.");
  };

  const handleAppeals = () => {
    console.log("Navigate to Appeals");
    // navigation.navigate('Appeals');
    Alert.alert("Navigate", "This will open the Appeals screen.");
  };

  const renderToggleOption = ({
    title,
    subtitle,
    value,
    onValueChange,
    iconName,
  }) => (
    <View style={styles.toggleRow}>
      <Ionicons
        name={iconName}
        size={24}
        color={ACCENT_COLOR}
        style={styles.leftIcon}
      />
      <View style={styles.toggleTextContainer}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: LIGHT_GRAY, true: ACCENT_COLOR }}
        thumbColor={"#ffffff"}
        ios_backgroundColor={LIGHT_GRAY}
      />
    </View>
  );

  /**
   * Renders a navigation row that looks like a button.
   */
  const renderNavOption = ({ title, onPress, iconName }) => (
    <TouchableOpacity style={styles.navRow} onPress={onPress}>
      <Ionicons
        name={iconName}
        size={24}
        color={ACCENT_COLOR}
        style={styles.leftIcon}
      />
      <Text style={styles.navRowText}>{title}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color={MEDIUM_GRAY} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* --- Header --- */}
      <ScreenHeader title="Privacy & Safety" navigation={navigation} showBack={true}/>

      {/* --- Scrollable Content --- */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.contentContainer}>
          {/* --- Privacy Section --- */}
          <Text style={styles.sectionTitle}>Privacy</Text>
          {renderToggleOption({
            title: "Show 'Online' Status",
            subtitle: "Let others see when you are active.",
            value: showOnlineStatus,
            onValueChange: toggleOnlineStatus,
            iconName: "eye-outline",
          })}
          {renderToggleOption({
            title: "Send Read Receipts",
            subtitle: "Allow others to see when you read messages.",
            value: sendReadReceipts,
            onValueChange: toggleReadReceipts,
            iconName: "checkmark-done-outline",
          })}

          <View style={styles.divider} />

          {/* --- Moderation Section --- */}
          <Text style={styles.sectionTitle}>Moderation</Text>
          {renderNavOption({
            title: "Blocked Users",
            onPress: handleBlockedUsers,
            iconName: "person-remove-outline",
          })}
          {renderNavOption({
            title: "My Report History",
            onPress: handleReportHistory,
            iconName: "document-text-outline",
          })}
          {renderNavOption({
            title: "My Appeals",
            onPress: handleAppeals,
            iconName: "shield-checkmark-outline",
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  navRowText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "500",
    color: "#000000",
  },
});
