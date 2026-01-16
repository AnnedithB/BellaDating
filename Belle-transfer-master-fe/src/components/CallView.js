import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { userAPI } from '../services/api';

export default function CallView({
  callDuration,
  onEndCall,
  formatCallTime,
  matchedUser,
  matchedUserId,
  onVideoCall,
  onMatch,
  onSkip,
  callStatus = 'idle',
  showButtons = true
}) {
  console.log('[CallView] Rendered. Props - CallStatus:', callStatus, 'CallDuration:', callDuration, 'ShowButtons:', showButtons);
  const [profile, setProfile] = useState(matchedUser || null);
  const [loading, setLoading] = useState(!matchedUser && !!matchedUserId);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (matchedUser) {
        setProfile(matchedUser);
        setLoading(false);
        return;
      }

      if (matchedUserId) {
        try {
          setLoading(true);
          setError(null);
          console.log('[CallView] Fetching profile for userId:', matchedUserId);
          const userData = await userAPI.getUser(matchedUserId);
          console.log('[CallView] Fetched user data:', {
            id: userData?.id,
            name: userData?.name,
            hasData: !!userData,
            languages: userData?.languages,
            ethnicity: userData?.ethnicity,
            religion: userData?.religion,
            educationLevel: userData?.educationLevel,
            familyPlans: userData?.familyPlans,
            hasKids: userData?.hasKids,
            politicalViews: userData?.politicalViews,
            exercise: userData?.exercise,
            smoking: userData?.smoking,
            drinking: userData?.drinking,
            photos: userData?.photos,
          });
          
          if (!userData) {
            console.error('[CallView] getUser returned null/undefined for userId:', matchedUserId);
            setError(`User profile not found (ID: ${matchedUserId})`);
            setProfile(null);
          } else if (!userData.id) {
            console.error('[CallView] getUser returned invalid data (missing id):', userData);
            setError('Invalid user profile data received');
            setProfile(null);
          } else {
            setProfile(userData);
          }
        } catch (err) {
          console.error('[CallView] Error fetching user profile:', {
            error: err,
            message: err?.message,
            userId: matchedUserId,
            stack: err?.stack,
          });
          const errorMessage = err?.message || 'Failed to load profile';
          setError(errorMessage);
          setProfile(null);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [matchedUser, matchedUserId]);

  // Format age display
  const formatAge = (age) => {
    if (!age) return '';
    return `${age}`;
  };

  // Format location
  const formatLocation = (location) => {
    if (!location) return '';
    if (typeof location === 'string') return location.toUpperCase();
    return location;
  };

  // Format relationship intent
  const formatIntent = (intent) => {
    if (!intent) return '';
    const intentMap = {
      'DATING': 'Dating',
      'CASUAL': 'Casual',
      'FRIENDSHIP': 'Friendship',
      'LONG_TERM': 'Long-term relationship',
      'MARRIAGE': 'Marriage'
    };
    return intentMap[intent] || intent;
  };

  if (loading) {
    return (
      <View style={[styles.callContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.callContainer, styles.loadingContainer]}>
        <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
        <Text style={styles.errorText}>{error || 'Profile not available'}</Text>
      </View>
    );
  }

  const displayName = profile.name || profile.displayName || 'Unknown';
  const age = profile.age ? formatAge(profile.age) : '';
  const location = formatLocation(profile.location);
  const bio = profile.bio || profile.shortBio || '';
  const interests = profile.interests || [];
  const photos = profile.photos || [];
  const profilePicture = profile.profilePicture || (photos.length > 0 ? photos[0] : null);
  const isPhotoVerified = profile.isPhotoVerified || false;

  const formatPreferenceValue = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(', ');
    }
    return String(value);
  };

  const aboutMeItems = [
    {
      key: 'religion',
      label: 'Religion',
      value: profile.religion,
      icon: 'ribbon',
    },
    {
      key: 'education',
      label: 'Education',
      value: profile.educationLevel,
      icon: 'school',
    },
    {
      key: 'familyPlans',
      label: 'Family Plans',
      value: profile.familyPlans,
      icon: 'people',
    },
    {
      key: 'hasKids',
      label: 'Has Kids',
      value: profile.hasKids,
      icon: 'happy',
    },
    {
      key: 'languages',
      label: 'Languages',
      value: profile.languages,
      icon: 'language',
    },
    {
      key: 'ethnicity',
      label: 'Ethnicity',
      value: profile.ethnicity,
      icon: 'earth',
    },
    {
      key: 'politicalViews',
      label: 'Political Views',
      value: profile.politicalViews,
      icon: 'flag',
    },
    {
      key: 'lifestyle',
      label: 'Lifestyle',
      value: [profile.exercise, profile.smoking, profile.drinking].filter(Boolean),
      icon: 'fitness',
    },
  ].filter((item) => formatPreferenceValue(item.value));

  console.log('[CallView]', {
    file: 'src/components/CallView.js',
    aboutMeItems: aboutMeItems.map((item) => ({ key: item.key, value: item.value })),
  });
  return (
    <View style={styles.callContainer}>
      <View style={styles.callTopBar}>

        {callStatus === 'calling' ? (
          <View style={[styles.callDuration, { backgroundColor: '#FFA500' }]}>
            <Ionicons name="call" size={12} color="#ffffff" />
            <Text style={styles.callDurationText}>Ringing...</Text>
          </View>
        ) : callDuration > 0 ? (
          <View style={styles.callDuration}>
            <Ionicons name="call" size={12} color="#ffffff" />
            <Text style={styles.callDurationText}>{formatCallTime(callDuration)}</Text>
          </View>
        ) : (
          <View style={styles.callDurationPlaceholder} />
        )}
        {showButtons && (
          <View style={styles.callTopIcons}>
            <TouchableOpacity
              style={styles.topIconButton}
              onPress={onVideoCall}
              activeOpacity={0.7}
            >
              <Ionicons name="videocam" size={20} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topIconButton}
              onPress={onMatch}
              activeOpacity={0.7}
            >
              <Ionicons name="heart" size={20} color="#ff4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.profileDetails} showsVerticalScrollIndicator={false}>
        <View style={styles.profileImageContainer}>
          {profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.profileImage}>
              <Ionicons name="person" size={100} color="#cccccc" />
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
            locations={[0.3, 1]}
            style={styles.imageOverlay}
          />

          <View style={styles.profileInfoOverlay}>
            {isPhotoVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#4CAF50" />
                <Text style={styles.verifiedText}>Photo Verified</Text>
              </View>
            )}
            <Text style={styles.profileName}>
              {displayName}{age ? `, ${age}` : ''}
            </Text>
            {profile.educationLevel && (
              <Text style={styles.profileTitle}>
                {profile.educationLevel}
                {profile.profession ? ` · ${profile.profession}` : ''}
              </Text>
            )}
            {location && (
              <Text style={styles.profileLocation}>{location}</Text>
            )}
          </View>
        </View>

        {bio ? (
          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>Bio</Text>
            <Text style={styles.bioText}>{bio}</Text>
          </View>
        ) : null}

        {profile.intent || profile.relationshipIntents ? (
          <View style={styles.lookingForSection}>
            <Text style={styles.lookingForTitle}>Looking For</Text>
            <Text style={styles.lookingForText}>
              {profile.relationshipIntents && profile.relationshipIntents.length > 0
                ? profile.relationshipIntents.map(i => formatIntent(i)).join(' · ')
                : formatIntent(profile.intent)}
            </Text>
          </View>
        ) : null}

        <View style={styles.aboutMeSection}>
          <Text style={styles.sectionTitle}>About Me</Text>
          {aboutMeItems.length > 0 ? (
            <View style={styles.aboutMeGrid}>
              {aboutMeItems.map((item) => (
                <View key={item.key} style={styles.aboutCard}>
                  <Ionicons name={item.icon} size={20} color="#666666" />
                  <Text style={styles.aboutCardLabel}>{item.label}</Text>
                  <Text style={styles.aboutCardValue}>{formatPreferenceValue(item.value)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.aboutMeEmpty}>No preferences added yet.</Text>
          )}
        </View>

        {interests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestTagText}>
                    {typeof interest === 'string' ? interest : interest.name || interest}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {photos && photos.length > 1 && (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Additional Photos</Text>
            <View style={styles.photosContainer}>
              {photos.slice(1).map((photo, index) => (
                <View key={index} style={styles.photoCard}>
                  {photo ? (
                    <Image
                      source={{ uri: photo }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="image-outline" size={60} color="#cccccc" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.callControls}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="mic" size={24} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={onEndCall}>
          <Ionicons name="call" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onSkip}>
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
  aboutMeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  aboutCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  aboutCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  aboutCardValue: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  },
  aboutMeEmpty: {
    fontSize: 14,
    color: '#666666',
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
    marginBottom: 0,
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
    overflow: 'hidden',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
  },
  callDurationPlaceholder: {
    width: 80,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
});