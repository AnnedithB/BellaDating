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
  interests: [],
  heightRange: [160, 190],
  education: null,
  familyPlans: null,
  hasKids: null,
  religion: null,
  politicalViews: null,
  drink: null,
  smoke: null,
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
const INTEREST_OPTIONS = [
  'Sports','Music','Travel','Cooking','Gaming','Fitness','Art','Reading','Outdoors'
];
const EDUCATION_OPTIONS = ["High School", "Bachelor's", "Master's", "PhD", "Other"];
const FAMILY_PLANS_OPTIONS = ["Wants kids", "Undecided", "Doesn't want kids"];
const RELIGION_OPTIONS = ["None","Christianity","Islam","Hinduism","Buddhism","Other"];
const POLITICAL_OPTIONS = ["Conservative","Moderate","Liberal","Other"];
const DRINK_OPTIONS = ["No","Sometimes","Yes"];
const SMOKE_OPTIONS = ["No","Sometimes","Yes"];

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
  const [interests, setInterests] = useState(DEFAULT_PREFERENCES.interests);
  const [heightRange, setHeightRange] = useState(DEFAULT_PREFERENCES.heightRange);
  const [education, setEducation] = useState(DEFAULT_PREFERENCES.education);
  const [familyPlans, setFamilyPlans] = useState(DEFAULT_PREFERENCES.familyPlans);
  const [hasKids, setHasKids] = useState(DEFAULT_PREFERENCES.hasKids);
  const [religion, setReligion] = useState(DEFAULT_PREFERENCES.religion);
  const [politicalViews, setPoliticalViews] = useState(DEFAULT_PREFERENCES.politicalViews);
  const [drink, setDrink] = useState(DEFAULT_PREFERENCES.drink);
  const [smoke, setSmoke] = useState(DEFAULT_PREFERENCES.smoke);

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
        setInterests(prefs.interests || []);
        setHeightRange([prefs.heightMin || DEFAULT_PREFERENCES.heightRange[0], prefs.heightMax || DEFAULT_PREFERENCES.heightRange[1]]);
        setEducation(prefs.education || null);
        setFamilyPlans(prefs.familyPlans || null);
        setHasKids(prefs.hasKids ?? null);
        setReligion(prefs.religion || null);
        setPoliticalViews(prefs.politicalViews || null);
        setDrink(prefs.drink || null);
        setSmoke(prefs.smoke || null);
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

  const handleToggleInterest = useCallback((interest) => {
    setInterests(prev => prev.includes(interest) ? prev.filter(i=>i!==interest) : [...prev, interest]);
    setHasChanges(true);
  }, []);

  const handleHeightChange = useCallback((val) => {
    setHeightRange(val);
    setHasChanges(true);
  }, []);

  const handleEducationChange = useCallback((val) => { setEducation(val); setHasChanges(true); }, []);
  const handleFamilyPlansChange = useCallback((val) => { setFamilyPlans(val); setHasChanges(true); }, []);
  const handleHasKidsChange = useCallback((val) => { setHasKids(val); setHasChanges(true); }, []);
  const handleReligionChange = useCallback((val) => { setReligion(val); setHasChanges(true); }, []);
  const handlePoliticalChange = useCallback((val) => { setPoliticalViews(val); setHasChanges(true); }, []);
  const handleDrinkChange = useCallback((val) => { setDrink(val); setHasChanges(true); }, []);
  const handleSmokeChange = useCallback((val) => { setSmoke(val); setHasChanges(true); }, []);

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
        interests,
        heightMin: Math.round(heightRange[0]),
        heightMax: Math.round(heightRange[1]),
        education,
        familyPlans,
        hasKids,
        religion,
        politicalViews,
        drink,
        smoke,
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
        style={[styles.optionChip, isSelected && styles.optionButtonSelected]}
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 8 }}
            >
              {LOOKING_FOR_OPTIONS.map(renderLookingForOption)}
            </ScrollView>
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

          {/* --- Interests (Premium) --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests (Premium)</Text>
            <Text style={styles.sectionSubtitle}>Select interests to prioritize in matching</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
              {INTEREST_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionChip, interests.includes(opt) && styles.optionButtonSelected]}
                  onPress={() => handleToggleInterest(opt)}
                >
                  <Text style={[styles.optionButtonText, interests.includes(opt) && styles.optionButtonTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- Height Range (Premium) --- */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionTitle}>Height Range (cm)</Text>
              <Text style={styles.sliderValue}>{Math.round(heightRange[0])} - {Math.round(heightRange[1])} cm</Text>
            </View>
            <Slider
              containerStyle={styles.sliderComponentContainer}
              value={heightRange}
              onValueChange={handleHeightChange}
              minimumValue={140}
              maximumValue={230}
              step={1}
              minimumTrackTintColor={ACCENT_COLOR}
              maximumTrackTintColor={BACKGROUND_GRAY}
              renderThumbComponent={renderThumb}
              trackStyle={styles.sliderTrack}
            />
          </View>

          {/* --- Education (Premium) - small pill buttons --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            <View style={[styles.optionsContainerWrap, { marginHorizontal: -6 }]}>
              {EDUCATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionSmall, education === opt && styles.optionSmallSelected]}
                  onPress={() => handleEducationChange(opt)}
                >
                  <Text style={[styles.optionSmallText, education === opt && styles.optionSmallTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- Family Plans (Premium) - stacked cards --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Family Plans</Text>
            <View>
              {FAMILY_PLANS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionRowItem, familyPlans === opt && styles.optionRowItemSelected]}
                  onPress={() => handleFamilyPlansChange(opt)}
                >
                  <Text style={[styles.optionRowText, familyPlans === opt && styles.optionRowTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- Has Kids (Premium) - segmented toggle --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Has Kids</Text>
            <View style={styles.toggleGroup}>
              {['Yes','No','Prefer not to say'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionToggle, String(hasKids) === opt && styles.optionToggleSelected]}
                  onPress={() => handleHasKidsChange(opt === 'Yes' ? true : opt === 'No' ? false : null)}
                >
                  <Text style={[styles.optionToggleText, String(hasKids) === opt && styles.optionToggleTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- Religion (Premium) - small pills --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Religion</Text>
            <View style={[styles.optionsContainerWrap, { marginHorizontal: -6 }]}>
              {RELIGION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionSmall, religion === opt && styles.optionSmallSelected]}
                  onPress={() => handleReligionChange(opt)}
                >
                  <Text style={[styles.optionSmallText, religion === opt && styles.optionSmallTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- Political Views (Premium) - small pills --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Political Views</Text>
            <View style={[styles.optionsContainerWrap, { marginHorizontal: -6 }]}>
              {POLITICAL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionSmall, politicalViews === opt && styles.optionSmallSelected]}
                  onPress={() => handlePoliticalChange(opt)}
                >
                  <Text style={[styles.optionSmallText, politicalViews === opt && styles.optionSmallTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* --- Drink & Smoke (Premium) --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Drink</Text>
            <View style={styles.optionsContainerWrap}>
              {DRINK_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionTextOnly, drink === opt && styles.optionTextOnlySelected]}
                  onPress={() => handleDrinkChange(opt)}
                >
                  <Text style={[styles.optionTextOnlyText, drink === opt && styles.optionTextOnlyTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Smoke</Text>
            <View style={styles.optionsContainerWrap}>
              {SMOKE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionTextOnly, smoke === opt && styles.optionTextOnlySelected]}
                  onPress={() => handleSmokeChange(opt)}
                >
                  <Text style={[styles.optionTextOnlyText, smoke === opt && styles.optionTextOnlyTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    backgroundColor: '#F2F2F7',
    marginHorizontal: 8,
    marginVertical: 4,
    minWidth: 160,
    justifyContent: 'center',
    alignItems: 'center',
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
  /* Small pill for secondary options */
  optionSmall: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 6,
    marginVertical: 6,
    minWidth: 96,
    alignItems: 'center',
  },
  optionSmallSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  optionSmallText: {
    fontSize: 13,
    color: MEDIUM_GRAY,
    fontWeight: '500',
  },
  optionSmallTextSelected: {
    color: '#ffffff',
  },

  /* Row style for stacked options */
  optionRowItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginVertical: 6,
  },
  optionRowItemSelected: {
    borderColor: ACCENT_COLOR,
    backgroundColor: '#F9FAFB',
  },
  optionRowText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  optionRowTextSelected: {
    color: ACCENT_COLOR,
  },

  /* Toggle-like segmented control */
  toggleGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionToggle: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  optionToggleSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  optionToggleText: {
    color: MEDIUM_GRAY,
    fontWeight: '500',
  },
  optionToggleTextSelected: {
    color: '#ffffff',
  },

  /* Minimal text-only options for subtle choices */
  optionTextOnly: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  optionTextOnlySelected: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  optionTextOnlyText: {
    color: MEDIUM_GRAY,
    fontSize: 14,
  },
  optionTextOnlyTextSelected: {
    color: ACCENT_COLOR,
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
