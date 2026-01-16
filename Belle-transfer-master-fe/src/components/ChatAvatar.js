import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { config } from '../services/config';

const ChatAvatar = ({ isOnline, profilePicture, size = 50 }) => {
  const [imageError, setImageError] = useState(false);
  const avatarSize = { width: size, height: size, borderRadius: size / 2 };
  
  // Build full URL if profilePicture is a relative path
  const getImageUri = () => {
    if (!profilePicture) return null;
    
    // If it's already a full URL, return as is
    if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://')) {
      return profilePicture;
    }
    
    // If it's a relative path, try to construct full URL
    const baseUrl = config.USER_SERVICE_URL || config.GRAPHQL_URL || '';
    if (baseUrl && profilePicture.startsWith('/')) {
      return `${baseUrl}${profilePicture}`;
    }
    
    return profilePicture;
  };
  
  const imageUri = getImageUri();
  const showImage = imageUri && !imageError;
  
  return (
    <View style={[styles.avatarContainer, { width: size, height: size }]}>
      {showImage ? (
        <Image 
          source={{ uri: imageUri }} 
          style={[styles.avatarImage, avatarSize]}
          onError={() => {
            console.warn('Failed to load profile picture:', imageUri);
            setImageError(true);
          }}
        />
      ) : (
        <View style={[styles.avatar, avatarSize]}>
          <Ionicons name="person" size={size * 0.48} color="#8E8E93" />
        </View>
      )}
      {isOnline && <View style={styles.onlineIndicator} />}
    </View>
  );
};

const styles = StyleSheet.create({
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    backgroundColor: '#F2F2F7',
    resizeMode: 'cover',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});

export default ChatAvatar;
