import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../components";
import { Slider } from "@miblanchard/react-native-slider";
import { preferencesAPI } from "../services/api";

const DEFAULT_PREFERENCES = {
  ageRange: [18, 65],
  maxDistance: 50,
  interestedIn: "Everyone",
  connectionType: "Dating",
  lookingFor: ["Dating"],
  showOnDiscovery: true,
};

const ACCENT_COLOR = "#000000";
const LIGHT_GRAY = "#E5E7EB";
const MEDIUM_GRAY = "#6B7280";
const BACKGROUND_GRAY = "#f3f4f6";

const SCREEN_WIDTH = Dimensions.get("window").width;

const CONNECTION_TYPES = ["Dating", "Friendship", "Networking"];
const LOOKING_FOR_OPTIONS = [
  "A long-term relationship",
  "Casual Dates",
  "Marriage",
  "Intimacy",
  "Intimacy Without Commitment",
  "Life Partner",
  "Ethical Non-Monogamy",
];

export default function PreferencesScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // --- Preferences State ---
  const [ageRange, setAgeRange] = useState(DEFAULT_PREFERENCES.ageRange);
  const [maxDistance, setMaxDistance] = useState(DEFAULT_PREFERENCES.maxDistance);
  const [interestedIn, setInterestedIn] = useState(DEFAULT_PREFERENCES.interestedIn);
  const [connectionType, setConnectionType] = useState(DEFAULT_PREFERENCES.connectionType);
  const [lookingFor, setLookingFor] = useState(DEFAULT_PREFERENCES.lookingFor);
  const [showOnDiscovery, setShowOnDiscovery] = useState(DEFAULT_PREFERENCES.showOnDiscovery);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsPageLoading(true);
      const prefs = await preferencesAPI.getDiscoveryPreferences();

      if (prefs) {
        setAgeRange([prefs.ageMin || 18, prefs.ageMax || 65]);
        setMaxDistance(prefs.maxDistance || 50);
        setInterestedIn(prefs.interestedIn || "Everyone");
        setConnectionType(prefs.connectionType || "Dating");
        setLookingFor(prefs.lookingFor || ["Dating"]);
        setShowOnDiscovery(prefs.showOnDiscovery ?? true);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
      // Use defaults on error
    } finally {
      setIsPageLoading(false);
    }
  };

  // Track changes
  const handleAgeRangeChange = useCallback((value) => {
    setAgeRange(value);
    setHasChanges(true);
  }, []);

  const handleMaxDistanceChange = useCallback((value) => {
    setMaxDistance(value);
    setHasChanges(true);
  }, []);

  const handleInterestedInChange = useCallback((value) => {
    setInterestedIn(value);
    setHasChanges(true);
  }, []);

  const handleConnectionTypeChange = useCallback((value) => {
    setConnectionType(value);
    setHasChanges(true);
  }, []);

  const handleLookingForToggle = useCallback((option) => {
    setLookingFor((prev) => {
      if (prev.includes(option)) {
        // Remove if already selected (but keep at least one)
        if (prev.length > 1) {
          return prev.filter((item) => item !== option);
        }
        return prev;
      }
      // Add if not selected
      return [...prev, option];
    });
    setHasChanges(true);
  }, []);

  const handleShowOnDiscoveryChange = useCallback((value) => {
    setShowOnDiscovery(value);
    setHasChanges(true);
  }, []);

  // --- Save Handler ---
  const handleSave = async () => {
    setIsLoading(true);

    try {
      await preferencesAPI.updateDiscoveryPreferences({
        ageMin: ageRange[0],
        ageMax: ageRange[1],
        maxDistance: Math.round(maxDistance),
        interestedIn,
        connectionType,
        lookingFor,
        showOnDiscovery,
      });

      setHasChanges(false);
      Alert.alert(
        "Preferences Saved",
        "Your discovery settings have been updated."
      );
      navigation.goBack();
    } catch (error) {
      console.error("Error saving preferences:", error);
      Alert.alert("Error", "Failed to save preferences. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderGenderOption = (option) => {
    const isSelected = interestedIn === option;
    return (
      <TouchableOpacity
        key={option}
        style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
        onPress={() => handleInterestedInChange(option)}
      >
        <Text
          style={[
            styles.optionButtonText,
            isSelected && styles.optionButtonTextSelected,
          ]}
        >
          {option}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderConnectionTypeOption = (option) => {
    const isSelected = connectionType === option;
    return (
      <TouchableOpacity
        key={option}
        style={[styles.optionButtonWrap, isSelected && styles.optionButtonSelected]}
        onPress={() => handleConnectionTypeChange(option)}
      >
        <Text
          style={[
            styles.optionButtonText,
            isSelected && styles.optionButtonTextSelected,
          ]}
        >
          {option}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderLookingForOption = (option) => {
    const isSelected = lookingFor.includes(option);
    return (
      <TouchableOpacity
        key={option}
        style={[styles.optionButtonWrap, isSelected && styles.optionButtonSelected]}
        onPress={() => handleLookingForToggle(option)}
      >
        <Text
          style={[
            styles.optionButtonText,
            isSelected && styles.optionButtonTextSelected,
          ]}
        >
          {option}
        </Text>
      </TouchableOpacity>
    );
  };

  // Custom thumb component for the slider
  const renderThumb = useCallback(() => (
    <View style={styles.sliderThumb}>
      <View style={styles.sliderThumbInner} />
    </View>
  ), []);

  if (isPageLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Preferences" navigation={navigation} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* --- Header --- */}
      <ScreenHeader title="Preferences" navigation={navigation} showBack={true} />

      {/* --- Scrollable Content --- */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.contentContainer}>
          {/* --- Connection Type Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection Type</Text>
            <View style={styles.optionsContainerWrap}>
              {CONNECTION_TYPES.map(renderConnectionTypeOption)}
            </View>
          </View>

          {/* --- Looking For Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Looking For</Text>
            <Text style={styles.sectionSubtitle}>Select all that apply</Text>
            <View style={styles.optionsContainerWrap}>
              {LOOKING_FOR_OPTIONS.map(renderLookingForOption)}
            </View>
          </View>

          {/* --- Interested In Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interested In</Text>
            <View style={styles.optionsContainer}>
              {["Men", "Women", "Everyone"].map(renderGenderOption)}
            </View>
          </View>

          {/* --- Age Range Section --- */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionTitle}>Age Range</Text>
              <Text style={styles.sliderValue}>
                {Math.round(ageRange[0])} - {Math.round(ageRange[1])}
              </Text>
            </View>
            <Slider
              containerStyle={styles.sliderComponentContainer}
              value={ageRange}
              onValueChange={handleAgeRangeChange}
              minimumValue={18}
              maximumValue={65}
              step={1}
              minimumTrackTintColor={ACCENT_COLOR}
              maximumTrackTintColor={BACKGROUND_GRAY}
              renderThumbComponent={renderThumb}
              trackStyle={styles.sliderTrack}
            />
          </View>

          {/* --- Distance Section --- */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionTitle}>Maximum Distance</Text>
              <Text style={styles.sliderValue}>
                {Math.round(maxDistance)} mi.
              </Text>
            </View>
            <Slider
              containerStyle={styles.sliderComponentContainer}
              value={maxDistance}
              onValueChange={handleMaxDistanceChange}
              minimumValue={1}
              maximumValue={100}
              step={1}
              minimumTrackTintColor={ACCENT_COLOR}
              maximumTrackTintColor={BACKGROUND_GRAY}
              renderThumbComponent={renderThumb}
              trackStyle={styles.sliderTrack}
            />
          </View>

          {/* --- Discovery Toggle Section --- */}
          <View style={[styles.section, styles.toggleRow]}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.sectionTitle}>Show me on Discovery</Text>
              <Text style={styles.sectionSubtitle}>
                While this is off, you won't be shown to anyone. You can still
                chat with your matches.
              </Text>
            </View>
            <Switch
              value={showOnDiscovery}
              onValueChange={handleShowOnDiscoveryChange}
              trackColor={{ false: LIGHT_GRAY, true: ACCENT_COLOR }}
              thumbColor={"#ffffff"}
              ios_backgroundColor={LIGHT_GRAY}
            />
          </View>
        </View>
      </ScrollView>

      {/* --- Sticky Save Button --- */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading || !hasChanges}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {hasChanges ? "Save" : "No Changes"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: MEDIUM_GRAY,
    lineHeight: 20,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: "500",
    color: MEDIUM_GRAY,
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionsContainerWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "center",
    marginHorizontal: -4,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  optionButtonWrap: {
    width: (SCREEN_WIDTH - 48) / 3 - 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    alignItems: "center",
    marginHorizontal: 4,
    marginVertical: 4,
  },
  optionButtonSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: MEDIUM_GRAY,
    textAlign: "center",
  },
  optionButtonTextSelected: {
    color: "#ffffff",
  },
  sliderComponentContainer: {
    height: 30,
    width: "100%",
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  sliderThumb: {
    backgroundColor: ACCENT_COLOR,
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 2,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { height: 1, width: 0 },
    justifyContent: "center",
    alignItems: "center",
  },
  sliderThumbInner: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: ACCENT_COLOR,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  saveButtonContainer: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#f3f4f6",
  },
  saveButton: {
    backgroundColor: ACCENT_COLOR,
    padding: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    backgroundColor: MEDIUM_GRAY,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
});
