import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/colors';

const ChatHeader = memo(({
  chatName,
  profilePicture,
  isOnline,
  isTyping,
  onBackPress,
  onCallPress,
  onMenuPress,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="#8E8E93" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{chatName || 'User'}</Text>
          <View style={styles.statusContainer}>
            {isTyping ? (
              <Text style={styles.typingText}>typing...</Text>
            ) : (
              <>
                <View
                  style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.gray }]}
                />
                <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.headerButton} onPress={onCallPress}>
          <Ionicons name="call-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={onMenuPress}>
          <Ionicons name="ellipsis-vertical-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  typingText: {
    fontSize: 12,
    color: colors.primary,
    fontStyle: 'italic',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;
