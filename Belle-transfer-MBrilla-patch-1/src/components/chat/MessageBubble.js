import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/colors';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const VoiceNoteContent = memo(({ duration }) => {
  // Memoize waveform bars to prevent re-creation
  const waveformBars = useMemo(() => {
    return [1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => (
      <View
        key={i}
        style={[
          styles.voiceNoteBar,
          {
            height: 4 + Math.random() * 16,
            backgroundColor: '#fff',
            opacity: 0.8 - i * 0.1,
          },
        ]}
      />
    ));
  }, []);

  return (
    <View style={styles.voiceNoteContent}>
      <Ionicons name="mic" size={20} color="#fff" />
      <View style={styles.voiceNoteWaveform}>{waveformBars}</View>
      <Text style={styles.voiceNoteDuration}>{formatTime(duration || 0)}</Text>
    </View>
  );
});

const MessageBubble = memo(({ message }) => {
  const { isVoiceNote, isMe, text, time, duration } = message;

  if (isVoiceNote) {
    return (
      <View style={[styles.messageContainer, styles.myMessage]}>
        <View style={[styles.voiceNoteBubble, styles.myBubble]}>
          <VoiceNoteContent duration={duration} />
          <Text style={[styles.timeText, styles.myTimeText]}>{time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.otherMessage]}>
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
          {text}
        </Text>
        <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
          {time}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.lightGray,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: colors.white,
  },
  otherMessageText: {
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimeText: {
    color: colors.darkGray,
  },
  voiceNoteBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  voiceNoteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceNoteWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    height: 20,
  },
  voiceNoteBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceNoteDuration: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
});

VoiceNoteContent.displayName = 'VoiceNoteContent';
MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
