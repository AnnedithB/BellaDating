import React, { memo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/colors';

const ChatInput = memo(({
  message,
  onChangeText,
  onSend,
  onVoicePress,
  isSending,
}) => {
  const canSend = message.trim().length > 0 && !isSending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.inputContainer}
    >
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={onChangeText}
          placeholder="Type a message..."
          placeholderTextColor={colors.gray}
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={onSend}
          disabled={!canSend}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name="send"
              size={24}
              color={canSend ? colors.primary : colors.gray}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.voiceButton} onPress={onVoicePress}>
          <Ionicons name="mic-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  inputContainer: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    backgroundColor: colors.background,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 24,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    maxHeight: 120,
    paddingVertical: 12,
    paddingLeft: 0,
    paddingRight: 8,
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
  voiceButton: {
    marginLeft: 8,
    padding: 8,
  },
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
