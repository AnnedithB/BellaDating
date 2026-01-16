import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CallView({ callDuration, onEndCall, formatCallTime }) {
  return (
    <View style={styles.callContainer}>
      <View style={styles.callTopBar}>
        <View style={styles.callDuration}>
          <Ionicons name="call" size={12} color="#ffffff" />
          <Text style={styles.callDurationText}>{formatCallTime(callDuration)}</Text>
        </View>
        <View style={styles.callTopIcons}>
          <TouchableOpacity style={styles.topIconButton}>
            <Ionicons name="videocam" size={20} color="#999999" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIconButton}>
            <Ionicons name="heart-outline" size={20} color="#999999" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.profileDetails} showsVerticalScrollIndicator={false}>
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
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#4CAF50" />
              <Text style={styles.verifiedText}>Photo Verified</Text>
            </View>
            <Text style={styles.profileName}>Emma, 29</Text>
            <Text style={styles.profileTitle}>MBA · Marketing Professional</Text>
            <Text style={styles.profileLocation}>LOS ANGELES</Text>
          </View>
        </View>

        <View style={styles.bioSection}>
          <Text style={styles.bioTitle}>Bio</Text>
          <Text style={styles.bioText}>Book lover and aspiring novelist. Looking for intellectual conversations.</Text>
        </View>

        <View style={styles.lookingForSection}>
          <Text style={styles.lookingForTitle}>Looking For</Text>
          <Text style={styles.lookingForText}>Dating · Long-term relationship</Text>
        </View>

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
              <Text style={styles.aboutBubbleValue}>English, Spanish</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="earth" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Ethnicity</Text>
              <Text style={styles.aboutBubbleValue}>Hispanic/Latina</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="ribbon" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Religion</Text>
              <Text style={styles.aboutBubbleValue}>Christian</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="flag" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Political Views</Text>
              <Text style={styles.aboutBubbleValue}>Moderate</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="people" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Family Plans</Text>
              <Text style={styles.aboutBubbleValue}>Wants kids someday</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="fitness" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Lifestyle</Text>
              <Text style={styles.aboutBubbleValue}>Exercises 3-4x/week</Text>
              <Text style={styles.aboutBubbleValue}>Non-smoker</Text>
              <Text style={styles.aboutBubbleValue}>Drinks socially</Text>
            </View>

            <View style={styles.aboutBubble}>
              <Ionicons name="school" size={20} color="#666666" />
              <Text style={styles.aboutBubbleLabel}>Education</Text>
              <Text style={styles.aboutBubbleValue}>MBA - Marketing</Text>
              <Text style={styles.aboutBubbleValue}>Professional</Text>
            </View>
          </ScrollView>
        </View>

        <View style={styles.interestsSection}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestsContainer}>
            <View style={styles.interestTag}>
              <Text style={styles.interestTagText}>Reading</Text>
            </View>
            <View style={styles.interestTag}>
              <Text style={styles.interestTagText}>Writing</Text>
            </View>
            <View style={styles.interestTag}>
              <Text style={styles.interestTagText}>Literature</Text>
            </View>
            <View style={styles.interestTag}>
              <Text style={styles.interestTagText}>Coffee</Text>
            </View>
          </View>
        </View>

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
            <View style={styles.photoCard}>
              <Ionicons name="image" size={80} color="#cccccc" />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.callControls}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="mic" size={24} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={onEndCall}>
          <Ionicons name="call" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="play-forward" size={24} color="#000000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  callContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
  },
  callTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  callDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    width: 80,
    justifyContent: 'center',
  },
  callDurationText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  callTopIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  topIconButton: {
    padding: 8,
  },
  profileImageContainer: {
    height: 400,
    position: 'relative',
    marginHorizontal: 20,
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
  profileDetails: {
    flex: 1,
    paddingBottom: 180,
  },
  bioSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  bioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  lookingForSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  lookingForTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  lookingForText: {
    fontSize: 16,
    color: '#000000',
  },
  aboutMeSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  aboutMeScroll: {
    marginHorizontal: -20,
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
  callControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  endCallButton: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
});