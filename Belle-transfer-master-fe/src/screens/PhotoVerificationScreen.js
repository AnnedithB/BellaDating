import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ScreenHeader } from '../components';
import { verificationAPI, authAPI, tokenStorage } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PhotoVerificationScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [selfieUri, setSelfieUri] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null); // 'success', 'failed', null

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to take a selfie for verification.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takeSelfie = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      // For iOS, ensure we use the front camera (selfie camera)
      // launchCameraAsync will use the default camera, but we can specify camera type
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        // Note: expo-image-picker doesn't directly support cameraType in launchCameraAsync
        // On iOS, the system will typically use the front camera for selfies
        // If you need guaranteed front camera, consider using expo-camera with CameraView
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelfieUri(result.assets[0].uri);
        setVerificationStatus(null);
      }
    } catch (error) {
      console.error('Error taking selfie:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const verifyPhoto = async () => {
    if (!selfieUri) {
      Alert.alert('No Photo', 'Please take a selfie first.');
      return;
    }

    setIsVerifying(true);
    setVerificationStatus(null);

    try {
      const result = await verificationAPI.verifyPhoto(selfieUri);

      if (result.success) {
        setVerificationStatus('success');
        
        // Refetch user data from server to get the latest verification status
        // This ensures the verification status persists across page refreshes
        try {
          const updatedUser = await authAPI.getCurrentUser();
          // Update stored user data to persist verification status
          await tokenStorage.setUser(updatedUser);
          // Update context with fresh data
          if (updateUser) {
            updateUser(updatedUser);
          }
        } catch (err) {
          console.error('Error updating user data after verification:', err);
          // Fallback: update in-memory state only
          if (updateUser) {
            updateUser({ isPhotoVerified: true });
          }
        }
        
        // Show success message briefly, then automatically navigate back
        Alert.alert(
          'Verification Successful',
          `Your photo has been verified with ${result.confidence?.toFixed(1)}% confidence.`,
          [],
          { cancelable: false }
        );
        
        // Automatically navigate back to EditProfile after 1.5 seconds
        setTimeout(() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('EditProfile');
          }
        }, 1500);
      } else {
        setVerificationStatus('failed');
        Alert.alert(
          'Verification Failed',
          result.message || 'Photo verification failed. Please ensure your selfie clearly shows your face and matches your profile photos.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationStatus('failed');
      Alert.alert(
        'Error',
        error.message || 'Failed to verify photo. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const retakePhoto = () => {
    setSelfieUri(null);
    setVerificationStatus(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Photo Verification" navigation={navigation} showBack={true} />

      <View style={styles.content}>
        <View style={styles.instructionsContainer}>
          <Ionicons name="camera" size={48} color="#000000" style={styles.icon} />
          <Text style={styles.title}>Verify Your Photo</Text>
          <Text style={styles.instructions}>
            Take a clear selfie that shows your face. Make sure it matches your profile photos.
          </Text>
          <Text style={styles.subInstructions}>
            • Face the camera directly{'\n'}
            • Ensure good lighting{'\n'}
            • Remove any face coverings{'\n'}
            • Make sure your face is clearly visible
          </Text>
        </View>

        <View style={styles.photoContainer}>
          {selfieUri ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: selfieUri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={retakePhoto}
                disabled={isVerifying}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takeSelfie}
              disabled={isVerifying}
            >
              <Ionicons name="camera" size={48} color="#FFFFFF" />
              <Text style={styles.captureButtonText}>Take Selfie</Text>
            </TouchableOpacity>
          )}
        </View>

        {verificationStatus === 'success' && (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.statusText}>Verification Successful</Text>
          </View>
        )}

        {verificationStatus === 'failed' && (
          <View style={[styles.statusContainer, styles.statusFailed]}>
            <Ionicons name="close-circle" size={24} color="#EF4444" />
            <Text style={[styles.statusText, styles.statusTextFailed]}>
              Verification Failed
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.verifyButton,
            (!selfieUri || isVerifying) && styles.verifyButtonDisabled,
          ]}
          onPress={verifyPhoto}
          disabled={!selfieUri || isVerifying}
        >
          {isVerifying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify Photo</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructionsContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  instructions: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  subInstructions: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  captureButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  photoPreview: {
    width: 250,
    height: 333,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  statusFailed: {
    // Additional styles if needed
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  statusTextFailed: {
    color: '#EF4444',
  },
  verifyButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  verifyButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

