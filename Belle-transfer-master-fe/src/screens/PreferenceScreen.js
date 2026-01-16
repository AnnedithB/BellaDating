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
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "../components";
import { Slider } from "@miblanchard/react-native-slider";
import { preferencesAPI } from "../services/api";
import { Ionicons } from "@expo/vector-icons";

const DEFAULT_PREFERENCES = {
  ageRange: [18, 65],
  maxDistance: 50,
  interestedIn: "Everyone",
  connectionType: "Dating",
  lookingFor: ["Dating"],
};

// --- Mock Data for New Filters ---
const EDUCATION_OPTIONS = ["High School", "Trade School", "Undergraduate Degree", "Postgraduate Degree"];
const FAMILY_PLANS_OPTIONS = ["Want children", "Don't want children", "Have children", "Not sure"];
const KIDS_OPTIONS = ["Yes", "No"];
const RELIGION_OPTIONS = ["Agnostic", "Atheist", "Buddhist", "Catholic", "Christian", "Hindu", "Jewish", "Muslim", "Sikh", "Spiritual", "Other"];
const POLITICS_OPTIONS = ["Liberal", "Moderate", "Conservative", "Apolitical", "Other"];
const DRINKING_OPTIONS = ["Socially", "Frequently", "Never", "Sober"];
const SMOKING_OPTIONS = ["Socially", "Frequently", "Never"];
const INTERESTS_OPTIONS = [
  "Hiking", "Coffee", "Art", "Dogs", "Travel", "Reading", "Cooking", "Movies",
  "Music", "Fitness", "Gaming", "Photography", "Dancing", "Wine", "Cats",
  "Yoga", "Surfing", "Running", "Outdoors", "Foodie"
];

const ACCENT_COLOR = "#000000";
const LIGHT_GRAY = "#E5E7EB";
const MEDIUM_GRAY = "#6B7280";
const BACKGROUND_GRAY = "#f9f9f9";
const SCREEN_WIDTH = Dimensions.get("window").width;

const CONNECTION_TYPES = ["Dating", "Friendship", "Networking"];
const LOOKING_FOR_OPTIONS = [
  "A long-term relationship", "Casual Dates", "Marriage", "Intimacy",
  "Intimacy Without Commitment", "Life Partner", "Ethical Non-Monogamy"
];

export default function PreferencesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // --- Existing Preferences State ---
  const [ageRange, setAgeRange] = useState(DEFAULT_PREFERENCES.ageRange);
  const [maxDistance, setMaxDistance] = useState(DEFAULT_PREFERENCES.maxDistance);
  const [interestedIn, setInterestedIn] = useState(DEFAULT_PREFERENCES.interestedIn);
  const [connectionType, setConnectionType] = useState(DEFAULT_PREFERENCES.connectionType);
  const [lookingFor, setLookingFor] = useState(DEFAULT_PREFERENCES.lookingFor);

  // --- New Filters State ---
  // Note: These are local state for now as API might not support them yet
  const [heightRange, setHeightRange] = useState([140, 220]); // cm
  const [education, setEducation] = useState([]); // Multi-select
  const [familyPlans, setFamilyPlans] = useState(null); // Single-select
  const [hasKids, setHasKids] = useState(null); // Single-select
  const [religion, setReligion] = useState(null); // Single-select
  const [politics, setPolitics] = useState(null); // Single-select
  const [drinking, setDrinking] = useState(null); // Single-select
  const [smoking, setSmoking] = useState(null); // Single-select
  const [selectedInterests, setSelectedInterests] = useState([]);

  // --- Modal State ---
  const [activeModal, setActiveModal] = useState(null); // 'education', 'religion', etc.

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
        // Load advanced preferences
        if (prefs.interests) {
          setSelectedInterests(prefs.interests);
        }
        if (prefs.preferredEducationLevels) {
          setEducation(prefs.preferredEducationLevels);
        }
        // Single-select fields - take first value if array, or use value directly
        if (prefs.preferredFamilyPlans) {
          setFamilyPlans(Array.isArray(prefs.preferredFamilyPlans) ? prefs.preferredFamilyPlans[0] || null : prefs.preferredFamilyPlans);
        }
        if (prefs.preferredReligions) {
          setReligion(Array.isArray(prefs.preferredReligions) ? prefs.preferredReligions[0] || null : prefs.preferredReligions);
        }
        if (prefs.preferredPoliticalViews) {
          setPolitics(Array.isArray(prefs.preferredPoliticalViews) ? prefs.preferredPoliticalViews[0] || null : prefs.preferredPoliticalViews);
        }
        if (prefs.preferredDrinkingHabits) {
          setDrinking(Array.isArray(prefs.preferredDrinkingHabits) ? prefs.preferredDrinkingHabits[0] || null : prefs.preferredDrinkingHabits);
        }
        if (prefs.preferredSmokingHabits) {
          setSmoking(Array.isArray(prefs.preferredSmokingHabits) ? prefs.preferredSmokingHabits[0] || null : prefs.preferredSmokingHabits);
        }
        if (prefs.preferredHasKids) {
          const hasKidsValue = Array.isArray(prefs.preferredHasKids)
            ? (prefs.preferredHasKids.length > 0 ? prefs.preferredHasKids[0] : null)
            : prefs.preferredHasKids;
          setHasKids(hasKidsValue || null);
        } else {
          setHasKids(null);
        }
        if (prefs.heightMin && prefs.heightMax) {
          setHeightRange([prefs.heightMin, prefs.heightMax]);
        }
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setIsPageLoading(false);
    }
  };

  // --- Change Handlers ---
  const handleGenericChange = (setter, value) => {
    setter(value);
    setHasChanges(true);
  };

  const handleLookingForToggle = useCallback((option) => {
    setLookingFor((prev) => {
      if (prev.includes(option)) {
        return prev.filter((item) => item !== option);
      }
      return [...prev, option];
    });
    setHasChanges(true);
  }, []);

  const handleMultiSelectToggle = (setter, currentValues, option) => {
    const newValues = currentValues.includes(option)
      ? currentValues.filter(v => v !== option)
      : [...currentValues, option];
    setter(newValues);
    setHasChanges(true);
  };

  const handleSingleSelect = (setter, option) => {
    setter(option);
    setHasChanges(true);
    // Close modal after selection for single-select fields
    setActiveModal(null);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save preferences and get the updated response
      const updatedPrefs = await preferencesAPI.updateDiscoveryPreferences({
        ageMin: ageRange[0],
        ageMax: ageRange[1],
        maxDistance: Math.round(maxDistance),
        interestedIn,
        connectionType,
        lookingFor,
        interests: selectedInterests,
        preferredEducationLevels: Array.isArray(education) ? education : (education ? [education] : []), // Multi-select (array)
        preferredFamilyPlans: familyPlans ? [familyPlans] : [], // Single-select (convert to array for backend)
        preferredHasKids: hasKids ? [hasKids] : [], // Single-select (convert to array for backend)
        preferredReligions: religion ? [religion] : [], // Single-select (convert to array for backend)
        preferredPoliticalViews: politics ? [politics] : [], // Single-select (convert to array for backend)
        preferredDrinkingHabits: drinking ? [drinking] : [], // Single-select (convert to array for backend)
        preferredSmokingHabits: smoking ? [smoking] : [], // Single-select (convert to array for backend)
        heightMin: heightRange[0],
        heightMax: heightRange[1],
      });

      // Update local state with the response to ensure UI reflects saved values
      if (updatedPrefs) {
        setAgeRange([updatedPrefs.ageMin || 18, updatedPrefs.ageMax || 65]);
        setMaxDistance(updatedPrefs.maxDistance || 50);
        setInterestedIn(updatedPrefs.interestedIn || "Everyone");
        setConnectionType(updatedPrefs.connectionType || "Dating");
        setLookingFor(updatedPrefs.lookingFor || ["Dating"]);
        if (updatedPrefs.interests) {
          setSelectedInterests(updatedPrefs.interests);
        }
        if (updatedPrefs.preferredEducationLevels) {
          setEducation(updatedPrefs.preferredEducationLevels);
        }
        // Single-select fields - take first value if array, or use value directly, handle empty arrays
        if (updatedPrefs.preferredFamilyPlans) {
          const familyPlansValue = Array.isArray(updatedPrefs.preferredFamilyPlans)
            ? (updatedPrefs.preferredFamilyPlans.length > 0 ? updatedPrefs.preferredFamilyPlans[0] : null)
            : updatedPrefs.preferredFamilyPlans;
          setFamilyPlans(familyPlansValue || null);
        } else {
          setFamilyPlans(null);
        }
        if (updatedPrefs.preferredReligions) {
          const religionValue = Array.isArray(updatedPrefs.preferredReligions)
            ? (updatedPrefs.preferredReligions.length > 0 ? updatedPrefs.preferredReligions[0] : null)
            : updatedPrefs.preferredReligions;
          setReligion(religionValue || null);
        } else {
          setReligion(null);
        }
        if (updatedPrefs.preferredPoliticalViews) {
          const politicsValue = Array.isArray(updatedPrefs.preferredPoliticalViews)
            ? (updatedPrefs.preferredPoliticalViews.length > 0 ? updatedPrefs.preferredPoliticalViews[0] : null)
            : updatedPrefs.preferredPoliticalViews;
          setPolitics(politicsValue || null);
        } else {
          setPolitics(null);
        }
        if (updatedPrefs.preferredDrinkingHabits) {
          const drinkingValue = Array.isArray(updatedPrefs.preferredDrinkingHabits)
            ? (updatedPrefs.preferredDrinkingHabits.length > 0 ? updatedPrefs.preferredDrinkingHabits[0] : null)
            : updatedPrefs.preferredDrinkingHabits;
          setDrinking(drinkingValue || null);
        } else {
          setDrinking(null);
        }
        if (updatedPrefs.preferredSmokingHabits) {
          const smokingValue = Array.isArray(updatedPrefs.preferredSmokingHabits)
            ? (updatedPrefs.preferredSmokingHabits.length > 0 ? updatedPrefs.preferredSmokingHabits[0] : null)
            : updatedPrefs.preferredSmokingHabits;
          setSmoking(smokingValue || null);
        } else {
          setSmoking(null);
        }
        if (updatedPrefs.preferredHasKids) {
          const hasKidsValue = Array.isArray(updatedPrefs.preferredHasKids)
            ? (updatedPrefs.preferredHasKids.length > 0 ? updatedPrefs.preferredHasKids[0] : null)
            : updatedPrefs.preferredHasKids;
          setHasKids(hasKidsValue || null);
        } else {
          setHasKids(null);
        }
        if (updatedPrefs.heightMin && updatedPrefs.heightMax) {
          setHeightRange([updatedPrefs.heightMin, updatedPrefs.heightMax]);
        }
      }

      setHasChanges(false);
      Alert.alert("Preferences Saved", "Your discovery settings have been updated.");
      // Also reload preferences as a backup to ensure everything is in sync
      await loadPreferences();
      // Navigate back - DiscoveryScreen will refresh on focus
      navigation.goBack();
    } catch (error) {
      console.error("Error saving preferences:", error);
      Alert.alert("Error", "Failed to save preferences. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Helpers ---

  // --- Render Helpers ---

  const renderThumb = useCallback(() => (
    <View style={styles.sliderThumb}>
      <View style={styles.sliderThumbInner} />
    </View>
  ), []);

  const renderSelectionRow = (label, selectedValue, modalType, isMultiSelect = false) => {
    // Handle both array (multi-select) and single value (single-select)
    let valueText = "Open";
    if (isMultiSelect) {
      // Multi-select: expect array
      const valueArray = Array.isArray(selectedValue) ? selectedValue : (selectedValue ? [selectedValue] : []);
      valueText = valueArray.length > 0
        ? valueArray.filter(v => v != null && v !== '').join(", ")
        : "Open";
    } else {
      // Single-select: expect single value (not array)
      // If it's an array, take first value; if it's a value, use it; otherwise "Open"
      if (Array.isArray(selectedValue)) {
        valueText = selectedValue.length > 0 ? String(selectedValue[0]) : "Open";
      } else {
      valueText = selectedValue ? String(selectedValue) : "Open";
      }
    }

    return (
      <TouchableOpacity
        key={label}
        style={styles.selectionRow}
        onPress={() => setActiveModal(modalType)}
      >
        <Text style={styles.selectionLabel}>{label}</Text>
        <View style={styles.selectionValueContainer}>
          <Text style={styles.selectionValue} numberOfLines={1}>
            {valueText}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#C5C5C7" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderInterestsSection = () => (
    <View style={styles.inlineSection}>
      <View style={styles.interestHeader}>
        <Text style={styles.inlineLabel}>Interests</Text>
        <TouchableOpacity onPress={() => setActiveModal('interests')}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chipWrapper}>
        {selectedInterests.length === 0 ? (
          <Text style={styles.placeholderText}>Any interests</Text>
        ) : (
          selectedInterests.map((interest) => (
            <View key={interest} style={[styles.chip, styles.chipSelected, styles.readOnlyChip]}>
              <Text style={[styles.chipText, styles.chipTextSelected]}>{interest}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderSelectionModal = () => {
    let options = [];
    let currentSelection = null;
    let setter = null;
    let title = "";
    let isMultiSelect = false; // Track if this is multi-select or single-select

    switch (activeModal) {
      case 'education':
        options = EDUCATION_OPTIONS;
        currentSelection = education;
        setter = setEducation;
        title = "Education";
        isMultiSelect = true; // Education is multi-select
        break;
      case 'religion':
        options = RELIGION_OPTIONS;
        currentSelection = religion;
        setter = setReligion;
        title = "Religion";
        isMultiSelect = false; // Single-select
        break;
      case 'politics':
        options = POLITICS_OPTIONS;
        currentSelection = politics;
        setter = setPolitics;
        title = "Political Views";
        isMultiSelect = false; // Single-select
        break;
      case 'family':
        options = FAMILY_PLANS_OPTIONS;
        currentSelection = familyPlans;
        setter = setFamilyPlans;
        title = "Family Plans";
        isMultiSelect = false; // Single-select
        break;
      case 'interests':
        options = INTERESTS_OPTIONS;
        currentSelection = selectedInterests;
        setter = setSelectedInterests;
        title = "Interests";
        isMultiSelect = true; // Interests is multi-select
        break;
      case 'kids':
        options = KIDS_OPTIONS;
        currentSelection = hasKids;
        setter = setHasKids;
        title = "Do they have kids?";
        isMultiSelect = false; // Single-select
        break;
      case 'drinking':
        options = DRINKING_OPTIONS;
        currentSelection = drinking;
        setter = setDrinking;
        title = "Drinking";
        isMultiSelect = false; // Single-select
        break;
      case 'smoking':
        options = SMOKING_OPTIONS;
        currentSelection = smoking;
        setter = setSmoking;
        title = "Smoking";
        isMultiSelect = false; // Single-select
        break;
      default:
        return null;
    }

    return (
      <Modal
        visible={!!activeModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.modalContent}
            renderItem={({ item }) => {
              // Check if selected based on multi-select or single-select
              const isSelected = isMultiSelect
                ? (Array.isArray(currentSelection) && currentSelection.includes(item))
                : (currentSelection === item);
              
              return (
                <TouchableOpacity
                  style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  onPress={() => {
                    if (isMultiSelect) {
                      handleMultiSelectToggle(setter, currentSelection, item);
                    } else {
                      handleSingleSelect(setter, item);
                    }
                  }}
                >
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                    {item}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color="#000" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    );
  };

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
      <ScreenHeader title="Preferences" navigation={navigation} showBack={true} />

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
        nestedScrollEnabled={true}
      >

        {/* --- Core Preferences --- */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Basic Preferences</Text>

          <View style={styles.card}>
            {/* Connection Type */}
            <View style={styles.row}>
              <Text style={styles.label}>Connection Type</Text>
              <View style={styles.pillContainer}>
                {CONNECTION_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pill, connectionType === type && styles.pillSelected]}
                    onPress={() => handleGenericChange(setConnectionType, type)}
                  >
                    <Text style={[styles.pillText, connectionType === type && styles.pillTextSelected]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Interested In */}
            <View style={styles.row}>
              <Text style={styles.label}>Interested In</Text>
              <View style={styles.pillContainer}>
                {["Men", "Women", "Everyone"].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.pill, interestedIn === option && styles.pillSelected]}
                    onPress={() => handleGenericChange(setInterestedIn, option)}
                  >
                    <Text style={[styles.pillText, interestedIn === option && styles.pillTextSelected]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* --- Age & Distance (Sliders) --- */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Range Preferences</Text>
          <View style={styles.card}>
            {/* Age Range */}
            <View style={styles.sliderRow}>
              <View style={styles.sliderHeader}>
                <Text style={styles.label}>Age Range</Text>
                <Text style={styles.valueText}>{Math.round(ageRange[0])} - {Math.round(ageRange[1])}</Text>
              </View>
              <Slider
                containerStyle={styles.sliderContainer}
                value={ageRange}
                onValueChange={(val) => handleGenericChange(setAgeRange, val)}
                minimumValue={18}
                maximumValue={65}
                step={1}
                minimumTrackTintColor={ACCENT_COLOR}
                maximumTrackTintColor={LIGHT_GRAY}
                renderThumbComponent={renderThumb}
                trackStyle={styles.track}
              />
            </View>

            <View style={styles.divider} />

            {/* Max Distance */}
            <View style={styles.sliderRow}>
              <View style={styles.sliderHeader}>
                <Text style={styles.label}>Maximum Distance</Text>
                <Text style={styles.valueText}>{Math.round(maxDistance)} mi</Text>
              </View>
              <Slider
                containerStyle={styles.sliderContainer}
                value={maxDistance}
                onValueChange={(val) => handleGenericChange(setMaxDistance, val)}
                minimumValue={1}
                maximumValue={100}
                step={1}
                minimumTrackTintColor={ACCENT_COLOR}
                maximumTrackTintColor={LIGHT_GRAY}
                renderThumbComponent={renderThumb}
                trackStyle={styles.track}
              />
            </View>

            <View style={styles.divider} />

            {/* Height Filter (New) */}
            <View style={styles.sliderRow}>
              <View style={styles.sliderHeader}>
                <Text style={styles.label}>Height</Text>
                <Text style={styles.valueText}>{Math.round(heightRange[0])}cm - {Math.round(heightRange[1])}cm</Text>
              </View>
              <Slider
                containerStyle={styles.sliderContainer}
                value={heightRange}
                onValueChange={(val) => handleGenericChange(setHeightRange, val)}
                minimumValue={120}
                maximumValue={220}
                step={1}
                minimumTrackTintColor={ACCENT_COLOR}
                maximumTrackTintColor={LIGHT_GRAY}
                renderThumbComponent={renderThumb}
                trackStyle={styles.track}
              />
            </View>
          </View>
        </View>

        {/* --- Advanced Filters (Inline Chips) --- */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Advanced Filters</Text>
          <View style={styles.card}>
            {renderInterestsSection()}
            <View style={styles.divider} />
            {renderSelectionRow("Education", education, 'education', true)}
            {renderSelectionRow("Family Plans", familyPlans, 'family', false)}
            {renderSelectionRow("Do they have kids", hasKids, 'kids', false)}
            {renderSelectionRow("Religion", religion, 'religion', false)}
            {renderSelectionRow("Political Views", politics, 'politics', false)}
            {renderSelectionRow("Do they drink", drinking, 'drinking', false)}
            {renderSelectionRow("Do they smoke", smoking, 'smoking', false)}
          </View>
        </View>

        {/* --- Looking For (Tags) --- */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Looking For</Text>
          <View style={styles.card}>
            <View style={styles.tagContainer}>
              {LOOKING_FOR_OPTIONS.map((option) => {
                const isSelected = lookingFor.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.tag, isSelected && styles.tagSelected]}
                    onPress={() => handleLookingForToggle(option)}
                  >
                    <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

      </ScrollView>

      {/* --- Footer Button --- */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>{hasChanges ? "Save Preferences" : "Saved"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* --- Modals --- */}
      {renderSelectionModal()}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
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
    padding: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: MEDIUM_GRAY,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  subtext: {
    fontSize: 13,
    color: MEDIUM_GRAY,
    marginTop: 2,
  },
  pillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  pillTextSelected: {
    color: "#fff",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 16,
  },
  sliderRow: {
    marginBottom: 8,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  valueText: {
    fontSize: 15,
    color: ACCENT_COLOR,
    fontWeight: "600",
  },
  sliderContainer: {
    width: "100%",
    height: 30,
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  sliderThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  sliderThumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT_COLOR,
  },


  // Inline/Chip Styles
  inlineSection: {
    paddingVertical: 8,
  },
  inlineLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },
  chipWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  readOnlyChip: {
    opacity: 0.9,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  chipTextSelected: {
    color: "#fff",
  },
  interestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editText: {
    color: ACCENT_COLOR,
    fontWeight: "600",
    fontSize: 14,
  },
  placeholderText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontStyle: "italic",
  },

  // Tag Styles
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    marginBottom: 8,
  },
  tagSelected: {
    backgroundColor: ACCENT_COLOR,
  },
  tagText: {
    fontSize: 14,
    color: "#374151",
  },
  tagTextSelected: {
    color: "#fff",
    fontWeight: "500",
  },

  // Toggle Row
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleText: {
    flex: 1,
    paddingRight: 16,
  },

  // Footer
  footer: {
    padding: 16,
    paddingTop: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    zIndex: 10,
  },
  saveButton: {
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  doneButton: {
    fontSize: 16,
    fontWeight: "600",
    color: ACCENT_COLOR,
  },
  modalContent: {
    padding: 16,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalOptionSelected: {
    backgroundColor: "#F9FAFB",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#374151",
  },
  modalOptionTextSelected: {
    color: ACCENT_COLOR,
    fontWeight: "600",
  },

  // Selection Row Styles
  selectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  selectionLabel: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  selectionValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    marginLeft: 16,
  },
  selectionValue: {
    fontSize: 14,
    color: MEDIUM_GRAY,
    marginRight: 8,
    textAlign: "right",
  },
});