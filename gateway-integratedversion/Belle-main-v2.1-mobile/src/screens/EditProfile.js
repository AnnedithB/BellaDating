import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ImageBackground,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { ScreenHeader } from "../components";
import LocationModal from "../components/LocationModal";
import { userAPI, uploadAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const MOCK_ALL_INTERESTS = [
  "Hiking",
  "Coffee",
  "Art",
  "Dogs",
  "Travel",
  "Reading",
  "Cooking",
  "Movies",
  "Music",
  "Fitness",
  "Gaming",
  "Photography",
  "Dancing",
  "Wine",
  "Cats",
  "Yoga",
  "Surfing",
  "Running",
  "Outdoors",
  "Foodie",
];

const ACCENT_COLOR = "#000000";
const EIGHTEEN_YEARS_AGO = new Date(
  new Date().setFullYear(new Date().getFullYear() - 18)
);

export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // --- Profile State ---
  const [photos, setPhotos] = useState(Array(6).fill(null));
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState([]);
  const [location, setLocation] = useState("");
  const [dob, setDob] = useState(EIGHTEEN_YEARS_AGO);

  // Load profile data on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsPageLoading(true);
      const profile = await userAPI.getProfile();

      if (profile) {
        setDisplayName(profile.name || profile.username || "");
        setBio(profile.bio || "");
        setInterests(profile.interests || []);
        setLocation(profile.location || "");

        // Handle profile pictures - try photos array first, then profilePicture
        if (profile.photos && profile.photos.length > 0) {
          // Fill remaining slots with null (6 total slots)
          const existingPhotos = profile.photos.slice(0, 6);
          const newPhotos = [...existingPhotos, ...Array(6 - existingPhotos.length).fill(null)];
          console.log('[EditProfile] Loading photos from profile.photos:', newPhotos);
          setPhotos(newPhotos);
        } else if (profile.profilePicture) {
          const newPhotos = [profile.profilePicture, ...Array(5).fill(null)];
          console.log('[EditProfile] Loading profilePicture:', profile.profilePicture);
          setPhotos(newPhotos);
        } else {
          console.log('[EditProfile] No photos found in profile');
        }

        // Handle DOB if available
        if (profile.dateOfBirth) {
          setDob(new Date(profile.dateOfBirth));
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      // Fall back to auth user data
      if (user) {
        setDisplayName(user.name || user.username || "");
        setBio(user.bio || "");
        setInterests(user.interests || []);
        setLocation(user.location || "");
        if (user.profilePicture) {
          setPhotos([user.profilePicture, ...Array(5).fill(null)]);
        }
      }
    } finally {
      setIsPageLoading(false);
    }
  };

  // --- Modal State ---
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [isInterestsModalVisible, setIsInterestsModalVisible] = useState(false);
  const [tempInterests, setTempInterests] = useState(interests);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- Handlers ---
  const handleSave = async () => {
    try {
      setIsLoading(true);

      // Build update payload
      const updateData = {
        name: displayName.trim(),
        bio: bio.trim(),
        interests: interests,
        location: location.trim(),
      };

      // Upload new photos to S3
      const activePhotos = photos.filter(Boolean);
      if (activePhotos.length > 0) {
        const firstPhoto = activePhotos[0];

        // Check if it's a local file that needs uploading
        if (firstPhoto.startsWith('file://')) {
          try {
            // Upload to S3 and get public URL
            const publicUrl = await uploadAPI.uploadPhoto(firstPhoto);
            updateData.profilePicture = publicUrl;

            // Update local photos array with the uploaded URL
            const newPhotos = [...photos];
            const index = photos.indexOf(firstPhoto);
            if (index !== -1) {
              newPhotos[index] = publicUrl;
              setPhotos(newPhotos);
            }
          } catch (uploadError) {
            console.error("Error uploading photo:", uploadError);
            Alert.alert("Upload Error", "Failed to upload photo. Profile will be saved without the new photo.");
          }
        } else {
          // Already an existing URL
          updateData.profilePicture = firstPhoto;
        }
      }

      const updatedProfile = await userAPI.updateProfile(updateData);

      // Update local auth context
      if (updateUser) {
        updateUser({
          name: displayName,
          bio: bio,
          interests: interests,
          location: location,
          profilePicture: updateData.profilePicture,
        });
      }

      Alert.alert("Profile Saved!", "Your changes have been saved.");
      navigation.goBack();
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = async (index) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });

    if (!result.canceled) {
      const newPhotos = [...photos];
      newPhotos[index] = result.assets[0].uri;
      setPhotos(newPhotos);
    }
  };

  const handleDeletePhoto = (index) => {
    const newPhotos = [...photos];
    newPhotos[index] = null;
    // To keep photos packed at the start:
    const filtered = newPhotos.filter(Boolean);
    const newPadded = [...filtered, ...Array(6 - filtered.length).fill(null)];
    setPhotos(newPadded);
  };

  const formatDob = (date) => {
    if (!date) return "Not set";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // --- Date Picker Handlers ---
  const handleDateConfirm = (date) => {
    setDob(date);
    setShowDatePicker(false);
  };

  const handleDateCancel = () => {
    setShowDatePicker(false);
  };

  // --- Interest Handlers ---
  const handleRemoveInterest = (interestToRemove) => {
    setInterests(interests.filter((i) => i !== interestToRemove));
  };

  const onInterestsModalOpen = () => {
    setTempInterests(interests); // Sync temp state on open
    setIsInterestsModalVisible(true);
  };

  const onInterestsModalSave = () => {
    setInterests(tempInterests);
    setIsInterestsModalVisible(false);
  };

  const toggleInterest = (interest) => {
    if (tempInterests.includes(interest)) {
      setTempInterests(tempInterests.filter((i) => i !== interest));
    } else if (tempInterests.length < 5) {
      // Limit to 5 interests
      setTempInterests([...tempInterests, interest]);
    } else {
      Alert.alert("Maximum Reached", "You can select up to 5 interests.");
    }
  };

  // --- Render Components ---

  const renderPhotoSlot = (item, index) => {
    if (item) {
      // Slot with a photo
      return (
        <View key={index} style={styles.photoSlot}>
          <ImageBackground
            source={{ uri: item }}
            style={styles.photoImage}
            imageStyle={{ borderRadius: 8 }}
          >
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePhoto(index)}
            >
              <Ionicons name="close-circle" size={24} color={ACCENT_COLOR} />
            </TouchableOpacity>
          </ImageBackground>
        </View>
      );
    }
    // Empty slot
    return (
      <View key={index} style={styles.photoSlot}>
        <TouchableOpacity
          style={styles.addSlot}
          onPress={() => handleImagePick(index)}
        >
          <Ionicons name="add" size={32} color="#b0b0b0" />
        </TouchableOpacity>
      </View>
    );
  };

  if (isPageLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Edit Profile" navigation={navigation} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* --- Standard Header --- */}
      <ScreenHeader title="Edit Profile" navigation={navigation} showBack={true} />

      {/* --- Scrollable Content --- */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.contentContainer}>
          {/* --- Photo Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Photos</Text>
            <Text style={styles.sectionSubtitle}>
              Add at least 2 photos to continue. The first photo is your main
              one.
            </Text>
            <View style={styles.photoGrid}>
              {photos.map((item, index) => renderPhotoSlot(item, index))}
            </View>
          </View>

          {/* --- About Me Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Write a little about yourself..."
              multiline
              maxLength={500}
            />
            <Text style={styles.charCounter}>{bio.length}/500</Text>
          </View>

          {/* --- Interests Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestGrid}>
              {interests.map((interest) => (
                <View key={interest} style={styles.interestPill}>
                  <Text style={styles.interestText}>{interest}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveInterest(interest)}
                    style={styles.interestRemove}
                  >
                    <Ionicons name="close" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.interestPillAdd}
                onPress={onInterestsModalOpen}
              >
                <Ionicons name="add" size={16} color={ACCENT_COLOR} />
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Details Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Details</Text>
            {/* Display Name */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <TextInput
                style={styles.detailValueInput}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            {/* Birthday */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.detailLabel}>Birthday</Text>
              <View style={styles.detailValueContainer}>
                <Text style={styles.detailValue}>{formatDob(dob)}</Text>
                <Ionicons name="chevron-forward" size={20} color="#b0b0b0" />
              </View>
            </TouchableOpacity>

            {/* Location */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setIsLocationModalVisible(true)}
            >
              <Text style={styles.detailLabel}>Location</Text>
              <View style={styles.detailValueContainer}>
                <Text style={styles.detailValue}>{location}</Text>
                <Ionicons name="chevron-forward" size={20} color="#b0b0b0" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* --- Sticky Save Button --- */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* --- Modals --- */}
      <LocationModal
        visible={isLocationModalVisible}
        onClose={() => setIsLocationModalVisible(false)}
        onLocationSelect={(loc) => {
          setLocation(loc);
          setIsLocationModalVisible(false);
        }}
      />

      {/* --- Interests Modal --- */}
      <Modal
        visible={isInterestsModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsInterestsModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Interests</Text>
            <TouchableOpacity onPress={onInterestsModalSave}>
              <Text style={styles.modalSaveButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>
            Select up to 5 interests that describe you.
          </Text>
          <FlatList
            data={MOCK_ALL_INTERESTS}
            keyExtractor={(item) => item}
            contentContainerStyle={[styles.modalInterestGrid, { paddingBottom: insets.bottom }]}
            renderItem={({ item }) => {
              const isSelected = tempInterests.includes(item);
              return (
                <TouchableOpacity
                  style={[
                    styles.modalInterestPill,
                    isSelected && styles.modalInterestPillSelected,
                  ]}
                  onPress={() => toggleInterest(item)}
                >
                  <Text
                    style={[
                      styles.modalInterestText,
                      isSelected && styles.modalInterestTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* --- Date Picker --- */}
      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={handleDateCancel}
        maximumDate={EIGHTEEN_YEARS_AGO}
        date={dob || EIGHTEEN_YEARS_AGO} // Start with a valid date
      />
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
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  photoSlot: {
    width: "31%",
    aspectRatio: 3 / 4,
    marginBottom: "3%",
    borderRadius: 8,
  },
  addSlot: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9f9f9",
  },
  photoImage: {
    flex: 1,
    justifyContent: "flex-end",
  },
  deleteButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#ffffff",
    borderRadius: 20,
  },
  bioInput: {
    height: 120,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000000",
    textAlignVertical: "top",
  },
  charCounter: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 4,
  },
  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  interestPill: {
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    margin: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  interestText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
    marginRight: 6,
  },
  interestRemove: {
    paddingLeft: 2,
  },
  interestPillAdd: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  detailLabel: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
  },
  detailValueContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailValue: {
    fontSize: 16,
    color: "#6B7280",
    marginRight: 8,
  },
  detailValueInput: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "right",
    flex: 1,
  },
  // --- Modal Styles ---
  modalContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  modalSaveButton: {
    fontSize: 16,
    fontWeight: "600",
    color: ACCENT_COLOR,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalInterestGrid: {
    padding: 20,
  },
  modalInterestPill: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    margin: 5,
  },
  modalInterestPillSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  modalInterestText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  modalInterestTextSelected: {
    color: "#ffffff",
  },
  // --- Save Button Styles ---
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
  saveButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
});
