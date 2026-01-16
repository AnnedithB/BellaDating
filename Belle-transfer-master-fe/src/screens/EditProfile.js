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
import { userAPI, uploadAPI, tokenStorage, config } from "../services/api";
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
  const [gender, setGender] = useState(null); // MAN, WOMAN, NONBINARY
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  // Load profile data on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsPageLoading(true);
      const profile = await userAPI.getProfile();

      console.log('[EditProfile] Received profile data:', {
        name: profile?.name,
        bio: profile?.bio,
        location: profile?.location,
        interests: profile?.interests,
        age: profile?.age,
        photos: profile?.photos?.length,
        profilePicture: profile?.profilePicture,
        fullProfile: JSON.stringify(profile, null, 2),
      });

      if (profile) {
        setDisplayName(profile.name || "");
        setBio(profile.bio || "");
        setInterests(profile.interests || []);
        setLocation(profile.location || "");
        setGender(profile.gender || null);

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
        setDisplayName(user.name || "");
        setBio(user.bio || "");
        setInterests(user.interests || []);
        setLocation(user.location || "");
        setGender(user.gender || null);
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

      // Build update payload (exclude profilePicture - photos are handled separately)
      const updateData = {
        name: displayName.trim(),
        bio: bio.trim(),
        interests: interests,
        location: location.trim(),
        gender: gender, // Include gender in update
      };

      // Calculate and include age from date of birth
      if (dob) {
        const age = calculateAge(dob);
        if (age && age >= 18) {
          updateData.age = age;
        }
      }

      // Check if there are any local photos that haven't been uploaded yet
      const localPhotos = photos.filter(photo => photo && photo.startsWith('file://'));
      if (localPhotos.length > 0) {
        // Upload any remaining local photos
        for (let i = 0; i < photos.length; i++) {
          if (photos[i] && photos[i].startsWith('file://')) {
            try {
              const uploadedUrl = await userAPI.uploadProfilePhoto(photos[i]);
              const updatedPhotos = [...photos];
              updatedPhotos[i] = uploadedUrl;
              setPhotos(updatedPhotos);
            } catch (uploadError) {
              console.error("Error uploading photo:", uploadError);
              Alert.alert("Upload Error", `Failed to upload photo ${i + 1}. Please try again.`);
              setIsLoading(false);
              return;
            }
          }
        }
      }

      // Update profile (without profilePicture - it's handled via photo uploads)
      const updatedProfile = await userAPI.updateProfile(updateData);

      // Refetch fresh profile data from server to ensure we have the latest
      let freshProfile = null;
      try {
        freshProfile = await userAPI.getProfile();
      } catch (fetchError) {
        console.error("Error fetching fresh profile:", fetchError);
        // Continue with updatedProfile if refetch fails
      }

      // Update local auth context with server response (prefer fresh profile if available)
      if (updateUser) {
        const profileToUse = freshProfile || updatedProfile;
        const firstPhoto = photos.find(p => p && !p.startsWith('file://'));
        
        updateUser({
          name: profileToUse.name || displayName,
          bio: profileToUse.bio || bio,
          interests: profileToUse.interests || interests,
          location: profileToUse.location || location,
          profilePicture: profileToUse.profilePicture || firstPhoto || null,
          age: profileToUse.age || updateData.age,
          gender: profileToUse.gender || gender, // Include gender in context update
        });
      }

      Alert.alert("Profile Saved!", "Your changes have been saved.");
      
      // Reload profile data before going back to ensure UI is updated
      await loadProfile();
      
      // Navigate back if possible, otherwise navigate to Main
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // If there's no previous screen, navigate to Main (TabNavigator)
        navigation.navigate('Main');
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      const errorMessage = error.message || "Failed to save profile. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = async (index) => {
    try {
      // Request permissions first (especially important for iOS)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to upload photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Keep using MediaTypeOptions (deprecated but working)
        allowsEditing: true,
        aspect: [3, 4],
        quality: 1,
        // iOS-specific: allows selecting from all photos
        allowsMultipleSelection: false,
      });

      if (!result.canceled) {
        const localUri = result.assets[0].uri;
        const newPhotos = [...photos];
        newPhotos[index] = localUri;
        setPhotos(newPhotos);

        // Auto-save: Upload photo immediately
        setIsLoading(true);
        try {
          const uploadedUrl = await userAPI.uploadProfilePhoto(localUri);
          // Update the photos array with the uploaded URL
          const updatedPhotos = [...newPhotos];
          updatedPhotos[index] = uploadedUrl;
          setPhotos(updatedPhotos);
          
          // Update auth context with new profile picture if it's the first photo
          if (index === 0 && updateUser) {
            updateUser({ profilePicture: uploadedUrl });
          }
        } catch (uploadError) {
          console.error('Error uploading photo:', uploadError);
          Alert.alert(
            'Upload Error',
            'Failed to upload photo. Please try again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Revert to previous state on error
                  const revertedPhotos = [...photos];
                  setPhotos(revertedPhotos);
                },
              },
            ]
          );
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleDeletePhoto = async (index) => {
    const photoToDelete = photos[index];
    if (!photoToDelete) return;

    // If it's a local file (not yet uploaded), just remove it
    if (photoToDelete.startsWith('file://')) {
      const newPhotos = [...photos];
      newPhotos[index] = null;
      const filtered = newPhotos.filter(Boolean);
      const newPadded = [...filtered, ...Array(6 - filtered.length).fill(null)];
      setPhotos(newPadded);
      return;
    }

    // If it's an uploaded photo, delete it from the server
    try {
      setIsLoading(true);
      const token = await tokenStorage.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Use GraphQL gateway URL (it proxies to user-service)
      const response = await fetch(`${config.API_URL}/profile/media`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: photoToDelete,
          type: 'photo',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to delete photo');
      }

      // Remove from local state
      const newPhotos = [...photos];
      newPhotos[index] = null;
      const filtered = newPhotos.filter(Boolean);
      const newPadded = [...filtered, ...Array(6 - filtered.length).fill(null)];
      setPhotos(newPadded);
    } catch (error) {
      console.error('Error deleting photo:', error);
      Alert.alert('Error', 'Failed to delete photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDob = (date) => {
    if (!date) return "Not set";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* --- Standard Header --- */}
      <ScreenHeader title="Edit Profile" navigation={navigation} showBack={true} />

      {/* --- Scrollable Content --- */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        alwaysBounceVertical={false}
      >
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
                <Text style={styles.detailValue}>{location || "Not set"}</Text>
                <Ionicons name="chevron-forward" size={20} color="#b0b0b0" />
              </View>
            </TouchableOpacity>

            {/* Gender */}
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => setShowGenderPicker(true)}
            >
              <Text style={styles.detailLabel}>Gender</Text>
              <View style={styles.detailValueContainer}>
                <Text style={styles.detailValue}>
                  {gender === 'MAN' ? 'Man' : gender === 'WOMAN' ? 'Woman' : gender === 'NONBINARY' ? 'Non-binary' : 'Not set'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#b0b0b0" />
              </View>
            </TouchableOpacity>

            {/* Photo Verification Status */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Photo Verification</Text>
              <View style={styles.detailValueContainer}>
                <View style={[
                  styles.verificationBadge,
                  user?.isPhotoVerified ? styles.verificationBadgeVerified : styles.verificationBadgeNotVerified
                ]}>
                  <Text style={[
                    styles.verificationBadgeText,
                    user?.isPhotoVerified && styles.verificationBadgeTextVerified
                  ]}>
                    {user?.isPhotoVerified ? 'Verified' : 'Not Verified'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* --- Photo Verification Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>
              Verify your identity by taking a selfie that matches your profile photos.
            </Text>
            <TouchableOpacity
              style={[
                styles.verifyButton,
                user?.isPhotoVerified && styles.verifyButtonDisabled
              ]}
              onPress={() => navigation.navigate('PhotoVerification')}
              disabled={user?.isPhotoVerified}
            >
              <Ionicons 
                name={user?.isPhotoVerified ? "checkmark-circle" : "camera"} 
                size={20} 
                color="#FFFFFF" 
                style={{ marginRight: 8 }}
              />
              <Text style={styles.verifyButtonText}>
                {user?.isPhotoVerified ? 'Verified' : 'Verify Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* --- Sticky Save Button --- */}
      <View style={[styles.saveButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
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

      {/* --- Gender Picker Modal --- */}
      <Modal
        visible={showGenderPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
              <Text style={styles.modalSaveButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.genderOptionsContainer}>
            {['MAN', 'WOMAN', 'NONBINARY'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderOption,
                  gender === option && styles.genderOptionSelected
                ]}
                onPress={() => {
                  setGender(option);
                  setShowGenderPicker(false);
                }}
              >
                <Text style={[
                  styles.genderOptionText,
                  gender === option && styles.genderOptionTextSelected
                ]}>
                  {option === 'MAN' ? 'Man' : option === 'WOMAN' ? 'Woman' : 'Non-binary'}
                </Text>
                {gender === option && (
                  <Ionicons name="checkmark" size={20} color={ACCENT_COLOR} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

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
      {Platform.OS !== 'web' && (
        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          onConfirm={handleDateConfirm}
          onCancel={handleDateCancel}
          maximumDate={EIGHTEEN_YEARS_AGO}
          date={dob || EIGHTEEN_YEARS_AGO} // Start with a valid date
        />
      )}
      {Platform.OS === 'web' && showDatePicker && (
        <input
          type="date"
          max={EIGHTEEN_YEARS_AGO.toISOString().split('T')[0]}
          value={dob ? dob.toISOString().split('T')[0] : ''}
          onChange={(e) => {
            if (e.target.value) {
              handleDateConfirm(new Date(e.target.value));
            } else {
              handleDateCancel();
            }
          }}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            padding: '10px',
            fontSize: '16px',
          }}
          onBlur={handleDateCancel}
        />
      )}
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
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  contentContainer: {
    padding: 20,
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderColor: "#f3f4f6",
    zIndex: 10,
    minHeight: 80,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
  verificationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  verificationBadgeVerified: {
    backgroundColor: "#DCFCE7",
  },
  verificationBadgeNotVerified: {
    backgroundColor: "#FEE2E2",
  },
  verificationBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },
  verificationBadgeTextVerified: {
    color: "#166534",
  },
  verifyButton: {
    backgroundColor: "#000000",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  genderOptionsContainer: {
    padding: 20,
  },
  genderOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  genderOptionSelected: {
    backgroundColor: "#f9fafb",
  },
  genderOptionText: {
    fontSize: 16,
    color: "#374151",
  },
  genderOptionTextSelected: {
    color: ACCENT_COLOR,
    fontWeight: "600",
  },
});
