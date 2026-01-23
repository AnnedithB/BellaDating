import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function RequestReviewScreen({ navigation, route }) {
  const { request } = route.params || {};

  // Extended profile data
  const profileData = {
    name: request?.name || 'Unknown',
    age: 28,
    location: 'San Francisco, CA',
    bio: 'Coffee enthusiast, adventure seeker, and lover of good conversations. Always up for trying new restaurants or exploring hiking trails on the weekends.',
    interests: ['Travel', 'Photography', 'Fitness', 'Cooking', 'Music'],
    lookingFor: 'Dating · Long-term relationship',
    profilePicture: request?.profilePicture || 'https://randomuser.me/api/portraits/women/1.jpg',
    title: 'MBA · Marketing Professional',
    isVerified: true,
    languages: 'English, Spanish',
    ethnicity: 'Hispanic/Latina',
    religion: 'Christian',
    politicalViews: 'Moderate',
    familyPlans: 'Wants kids someday',
    lifestyle: ['Exercises 3-4x/week', 'Non-smoker', 'Drinks socially'],
    education: ['MBA - Marketing', 'Professional'],
  };

  const handleAccept = () => {
    Alert.alert(
      'Request Accepted',
      `You are now connected with ${profileData.name}!`,
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline ${profileData.name}'s request?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Request</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Image Container with Overlay */}
        <View style={styles.profileImageContainer}>
          <View style={styles.profileImage}>
            <Ionicons name="person" size={100} color="#cccccc" />
          </View>

          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
            locations={[0.3, 1]}
            style={styles.imageOverlay}
          />

          <View style={styles.profileInfoOverlay}>
            {profileData.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#4CAF50" />
                <Text style={styles.verifiedText}>Photo Verified</Text>
              </View>
            )}
            <Text style={styles.profileName}>
              {profileData.name}, {profileData.age}
            </Text>
            <Text style={styles.profileTitle}>{profileData.title}</Text>
            <Text style={styles.profileLocation}>{profileData.location.toUpperCase()}</Text>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioSection}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.bioText}>{profileData.bio}</Text>
        </View>

        {/* Looking For Section */}
        <View style={styles.lookingForSection}>
          <Text style={styles.sectionTitle}>Looking For</Text>
          <Text style={styles.lookingForText}>{profileData.lookingFor}</Text>
        </View>

        {/* About Me Section */}
        <View style={styles.aboutMeSection}>
          <Text style={styles.sectionTitle}>About Me</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.aboutMeScroll}
            contentContainerStyle={styles.aboutMeContent}
          >
            <View style={styles.aboutBubble}>
              <Ionicons name="language" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Languages</Text>
              <Text style={styles.aboutBubbleValue}>{profileData.languages}</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="earth" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Ethnicity</Text>
              <Text style={styles.aboutBubbleValue}>{profileData.ethnicity}</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="ribbon" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Religion</Text>
              <Text style={styles.aboutBubbleValue}>{profileData.religion}</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="flag" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Political Views</Text>
              <Text style={styles.aboutBubbleValue}>{profileData.politicalViews}</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="people" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Family Plans</Text>
              <Text style={styles.aboutBubbleValue}>{profileData.familyPlans}</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="fitness" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Lifestyle</Text>
              {profileData.lifestyle.map((item, index) => (
                <Text key={index} style={styles.aboutBubbleValue}>{item}</Text>
              ))}
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="school" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Education</Text>
              {profileData.education.map((item, index) => (
                <Text key={index} style={styles.aboutBubbleValue}>{item}</Text>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Interests Section */}
        <View style={styles.interestsSection}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestsContainer}>
            {profileData.interests.map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestTagText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Additional Photos Section */}
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>Additional Photos</Text>
          <View style={styles.photosContainer}>
            <View style={styles.photoCard}>
              <Ionicons name="image" size={80} color="#cccccc" />
            </View>
            <View style={styles.photoCard}>
              <Ionicons name="image" size={80} color="#cccccc" />
            </View>
            <View style={styles.photoCard}>
              <Ionicons name="image" size={80} color="#cccccc" />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={handleDecline}
        >
          <Ionicons name="close" size={24} color="#ff4444" />
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={handleAccept}
        >
          <Ionicons name="checkmark" size={24} color="#ffffff" />
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  profileImageContainer: {
    height: 400,
    position: 'relative',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 3,
  },
  verifiedText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
  },
  profileInfoOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileTitle: {
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 2,
  },
  profileLocation: {
    color: '#ffffff',
    fontSize: 12,
  },
  bioSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  lookingForSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  lookingForText: {
    fontSize: 16,
    color: '#000000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  aboutMeSection: {
    marginBottom: 24,
  },
  aboutMeScroll: {
    marginHorizontal: 0,
    paddingLeft: 20,
  },
  aboutMeContent: {
    paddingRight: 20,
    gap: 12,
  },
  aboutBubble: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    minWidth: 160,
    maxWidth: 200,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  aboutBubbleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  aboutBubbleValue: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  },
  interestsSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  interestTagText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  photosSection: {
    marginBottom: 120,
    paddingHorizontal: 20,
  },
  photosContainer: {
    gap: 12,
  },
  photoCard: {
    width: '100%',
    height: 400,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  declineButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4444',
  },
  acceptButton: {
    backgroundColor: '#000000',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
