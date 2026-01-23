import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';

const settingsItems = [
  {
    id: '1',
    title: 'Edit Profile',
    icon: 'person-outline',
    hasArrow: true,
  },
  {
    id: '2',
    title: 'Premium',
    icon: 'diamond-outline',
    hasArrow: true,
  },
  {
    id: '3',
    title: 'Preferences',
    icon: 'settings-outline',
    hasArrow: true,
  },
  {
    id: '4',
    title: 'Privacy & Safety',
    icon: 'shield-outline',
    hasArrow: true,
  },
  {
    id: '5',
    title: 'Notifications',
    icon: 'notifications-outline',
    hasArrow: true,
  },
  {
    id: '6',
    title: 'Help & Support',
    icon: 'help-circle-outline',
    hasArrow: true,
  },
  {
    id: '7',
    title: 'About',
    icon: 'information-circle-outline',
    hasArrow: true,
  },
  {
    id: '8',
    title: 'Logout',
    icon: 'log-out-outline',
    hasArrow: false,
    isDestructive: true,
  },
];

export default function ProfileScreen({ navigation }) {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await userAPI.getProfile();
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      // Use cached user data as fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Navigation will happen automatically through AuthContext
          },
        },
      ]
    );
  };

  const handleSettingPress = (item) => {
    if (item.id === '1') {
      navigation.navigate('EditProfile');
    } else if (item.id === '2') {
      navigation.navigate('Subscription');
    } else if (item.id === '3') {
      navigation.navigate('PreferenceScreen');
    } else if (item.id === '4') {
      navigation.navigate('PrivacyScreen');
    } else if (item.id === '5') {
      navigation.navigate('NotificationsScreen');
    } else if (item.id === '6') {
      navigation.navigate('Help');
    } else if (item.id === '8') {
      handleLogout();
    } else {
      console.log(`${item.title} pressed`);
    }
  };

  // Use profile data if available, otherwise fall back to user from auth
  const displayUser = profile || user;
  // Check multiple sources for the display name:
  // 1. displayName from nested profile object (from backend)
  // 2. name field directly on user
  // 3. username as fallback
  const displayName = displayUser?.profile?.displayName || displayUser?.displayName || displayUser?.name || displayUser?.username || 'User';
  const profilePicture = displayUser?.profile?.profilePicture || displayUser?.profilePicture;

  if (isLoading && !displayUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.profileImageCircle}>
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.profileImage}
              />
            ) : (
              <Ionicons name="person" size={45} color="#8E8E93" />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            {displayUser?.email && (
              <Text style={styles.profileEmail}>{displayUser.email}</Text>
            )}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          {settingsItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.settingItem}
              onPress={() => handleSettingPress(item)}
              disabled={authLoading && item.id === '8'}
            >
              <View style={styles.settingLeft}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.isDestructive ? '#FF3B30' : '#000000'}
                />
                <Text
                  style={[
                    styles.settingTitle,
                    item.isDestructive && styles.destructiveText,
                  ]}
                >
                  {item.title}
                </Text>
              </View>
              {item.hasArrow && (
                <Ionicons name="chevron-forward" size={16} color="#cccccc" />
              )}
              {item.id === '8' && authLoading && (
                <ActivityIndicator size="small" color="#FF3B30" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  editButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    paddingVertical: 30,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  profileImageCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 16,
    color: '#000000',
    marginLeft: 16,
  },
  destructiveText: {
    color: '#FF3B30',
  },
});
