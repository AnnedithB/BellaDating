import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CallNotification({
  visible,
  callerName,
  callerProfilePicture,
  onAccept,
  onDecline,
  onIgnore,
  onDismiss,
  onProfilePress,
  callerId,
}) {
  const glowAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(-100)).current; // Reduced slide distance

  useEffect(() => {
    let timeout;
    if (visible) {
      // Auto-dismiss after 7 seconds (receiver side - when ignored)
      timeout = setTimeout(() => {
        if (onDismiss) onDismiss();
        else if (onIgnore) onIgnore();
      }, 7000);

      // Slide in animation
      Animated.spring(slideAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Glowing pulse animation
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnimation, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      glowLoop.start();

      return () => {
        glowLoop.stop();
        clearTimeout(timeout);
      };
    } else {
      // Slide out animation
      Animated.timing(slideAnimation, {
        toValue: -150, // Move up out of view
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, glowAnimation, slideAnimation, onDismiss, onIgnore]);

  if (!visible) return null;

  const glowOpacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6], // Reduced opacity for subtlety
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onDismiss || onIgnore}
    >
      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.notificationContainer,
            {
              transform: [{ translateY: slideAnimation }], // Changed to translateY
            },
          ]}
        >
          <Animated.View
            style={[
              styles.glowEffect,
              {
                opacity: glowOpacity,
              },
            ]}
          />

          <LinearGradient
            colors={['#ffffff', '#fcfcfc']}
            style={styles.content}
          >
            {/* Left Side: Profile & Info - Clickable to show profile */}
            <TouchableOpacity
              style={styles.leftSection}
              onPress={onProfilePress}
              activeOpacity={0.7}
            >
              <View style={styles.profileContainer}>
                {callerProfilePicture ? (
                  <Image
                    source={{ uri: callerProfilePicture }}
                    style={styles.profilePicture}
                  />
                ) : (
                  <View style={[styles.profilePicture, styles.profilePlaceholder]}>
                    <Ionicons name="person" size={20} color="#8E8E93" />
                  </View>
                )}
                <View style={styles.callIcon}>
                  <Ionicons name="videocam" size={10} color="#ffffff" />
                </View>
              </View>
              <View style={styles.infoContainer}>
                <Text style={styles.callerName} numberOfLines={1}>
                  {callerName || 'Unknown'}
                </Text>
                <Text style={styles.callText}>Video Call...</Text>
              </View>
            </TouchableOpacity>

            {/* Right Side: Actions */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, styles.declineButton]}
                onPress={onDecline}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#FF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={onAccept}
                activeOpacity={0.7}
              >
                <Ionicons name="videocam" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // Status bar offset
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  notificationContainer: {
    width: '100%',
    maxWidth: 360, // Compact max width
    borderRadius: 30, // Pill shape
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  glowEffect: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    zIndex: -1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  profileContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  profilePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIcon: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  infoContainer: {
    flex: 1,
  },
  callerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    marginBottom: 0,
  },
  callText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
