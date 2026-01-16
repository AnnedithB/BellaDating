import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { sessionAPI } from '../services/api';
import CallNotification from './CallNotification';

/**
 * Global overlay that shows incoming call notifications on ANY screen.
 * This fixes the issue where User 2 wouldn't see the accept/decline/ignore UI unless they were on DiscoveryScreen.
 */
export default function GlobalCallNotification() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { pendingCallRequest, clearPendingCallRequest, emitCallResponse } = useSocket();
  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState(null);

  useEffect(() => {
    if (pendingCallRequest) {
      setRequest(pendingCallRequest);
      setVisible(true);
    }
  }, [pendingCallRequest]);

  const callerName = useMemo(() => request?.callerName || 'Someone', [request]);
  const callerProfilePicture = useMemo(() => request?.callerProfilePicture, [request]);

  const dismiss = () => {
    setVisible(false);
    setRequest(null);
    clearPendingCallRequest?.();
  };

  const accept = async () => {
    try {
      if (request?.callId) emitCallResponse(request.callId, 'accept', user?.name);

      // Create session/chat on accept so it appears in Chats
      let sessionId = request?.sessionId;

      if (!sessionId && request?.callerId) {
        try {
          const session = await sessionAPI.startSession(request.callerId, 'VIDEO');
          sessionId = session?.id;
        } catch (e) {
          console.warn('[GlobalCallNotification] Failed to create session on accept:', e?.message || e);
        }
      }

      if (sessionId && request?.callerId) {
        navigation.navigate('ChatConversation', {
          sessionId,
          partnerId: request.callerId,
          partnerName: callerName,
          partnerProfilePicture: callerProfilePicture, // Pass profile picture for CallView
          autoJoinCall: true,
        });
      }

      if (Platform.OS === 'web') {
        // Avoid noisy native alerts on web; just dismiss.
        dismiss();
      } else {
        Alert.alert('Call Accepted', 'Starting video call...');
        dismiss();
      }
    } catch (e) {
      console.error('[GlobalCallNotification] Accept failed:', e);
      dismiss();
    }
  };

  const decline = () => {
    if (request?.callId) emitCallResponse(request.callId, 'decline', user?.name);
    dismiss();
  };

  const ignore = () => {
    if (request?.callId) emitCallResponse(request.callId, 'ignore');
    dismiss();
  };

  const handleProfilePress = () => {
    if (request?.callerId) {
      // Navigate to user profile - we'll need to check if there's a profile screen
      // For now, navigate to ChatConversation to show their profile
      navigation.navigate('ChatConversation', {
        partnerId: request.callerId,
        partnerName: callerName,
        partnerProfilePicture: callerProfilePicture,
        showProfileOnly: true, // Flag to show profile only
      });
    }
  };

  return (
    <CallNotification
      visible={visible}
      callerName={callerName}
      callerProfilePicture={callerProfilePicture}
      onAccept={accept}
      onDecline={decline}
      onIgnore={ignore}
      onDismiss={ignore}
      onProfilePress={handleProfilePress}
      callerId={request?.callerId}
    />
  );
}


