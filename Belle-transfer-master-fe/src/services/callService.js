import { io } from 'socket.io-client';
import { config } from './config';
import { tokenStorage } from './api';
import { initializeSocket as initializeCommSocket, getSocket as getCommSocket } from './socket';

/**
 * WebRTC Call Service
 * Handles video/voice calls using Socket.IO signaling with the backend interaction-service
 */

// Call socket instance (separate from chat socket)
let callSocket = null;
let commSocketInitialized = false;

// Current call state
let currentRoom = null;
let currentCallState = {
  roomId: null,
  status: 'idle', // idle, connecting, connected, ended
  isVideoEnabled: false,
  videoRequestPending: false,
  participants: [],
  startTime: null,
};

// Event callbacks
const callEventCallbacks = new Map();

/**
 * Initialize call socket connection
 */
export const initializeCallSocket = async (userGender = 'male') => {
  if (callSocket?.connected) {
    console.log('Call socket already connected');
    return callSocket;
  }

  try {
    const token = await tokenStorage.getToken();

    if (!token) {
      console.log('No token available for call socket connection');
      return null;
    }

    // Connect to interaction service (port 3003 by default)
    const interactionServiceUrl = config.INTERACTION_SERVICE_URL || config.WS_URL.replace(':3005', ':3003');

    callSocket = io(interactionServiceUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!callSocket.connected) {
          console.warn('Call socket connection timed out, proceeding anyway (might rely on auto-connect)');
        }
        resolve();
      }, 5000);

      callSocket.once('connect', () => {
        clearTimeout(timeout);
        console.log('Call socket connected:', callSocket.id);
        // Authenticate with the server
        callSocket.emit('authenticate', { token, gender: userGender });
        resolve();
      });

      callSocket.once('connect_error', (err) => {
        console.error('Connection error during initialization:', err);
        // Don't reject, just let it try to reconnect or fail gracefully later
        clearTimeout(timeout);
        resolve();
      });
    });

    // Socket event handlers (moved out of the promise so they persist)
    callSocket.on('authenticated', (data) => {
      console.log('Call socket authenticated:', data);
      notifyCallbacks('authenticated', data);
    });

    callSocket.on('authentication-error', (error) => {
      console.error('Call socket authentication failed:', error);
      notifyCallbacks('error', { type: 'auth', message: error.message });
    });

    callSocket.on('connect_error', (error) => {
      console.error('Call socket connection error:', error.message);
      notifyCallbacks('error', { type: 'connection', message: error.message });
    });

    callSocket.on('disconnect', (reason) => {
      console.log('Call socket disconnected:', reason);
      resetCallState();
      notifyCallbacks('disconnected', { reason });
    });

    // Call-specific events
    setupCallEventHandlers();
    await setupCommEventHandlers();

    return callSocket;
  } catch (error) {
    console.error('Failed to initialize call socket:', error);
    return null;
  }
};

const setupCommEventHandlers = async () => {
  try {
    if (commSocketInitialized) {
      // Ensure socket is still connected, re-setup if needed
      const commSocket = getCommSocket();
      if (commSocket?.connected) {
        return; // Already initialized and connected
      } else {
        // Socket disconnected, reset flag to allow re-initialization
        commSocketInitialized = false;
      }
    }
    
    await initializeCommSocket();
    const commSocket = getCommSocket();
    if (!commSocket) {
      console.warn('Communication socket not available for call events');
      return;
    }

    // Wait for socket to be connected before setting up listeners
    if (!commSocket.connected) {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('Communication socket connection timeout, proceeding anyway');
          resolve();
        }, 5000);
        
        commSocket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    commSocketInitialized = true;

    // Remove existing listeners to prevent duplicates
    commSocket.off('call:heart:incoming');
    commSocket.off('call:heart:pending');
    commSocket.off('call:heart:accepted');
    commSocket.off('call:heart:expired');
    commSocket.off('call:video:incoming');
    commSocket.off('call:video:pending');
    commSocket.off('call:video:accepted');
    commSocket.off('call:video:declined');
    commSocket.off('match:unmatched');
    commSocket.off('match:skipped');

    commSocket.on('call:heart:incoming', (data) => {
      notifyCallbacks('call:heart:incoming', data);
    });

    commSocket.on('call:heart:pending', (data) => {
      notifyCallbacks('call:heart:pending', data);
    });

    commSocket.on('call:heart:accepted', (data) => {
      notifyCallbacks('call:heart:accepted', data);
    });

    commSocket.on('call:heart:expired', (data) => {
      notifyCallbacks('call:heart:expired', data);
    });

    commSocket.on('call:video:incoming', (data) => {
      console.log('[callService] Received call:video:incoming event:', data);
      notifyCallbacks('call:video:incoming', data);
    });

    commSocket.on('call:video:pending', (data) => {
      console.log('[callService] Received call:video:pending event:', data);
      notifyCallbacks('call:video:pending', data);
    });

    commSocket.on('call:video:accepted', (data) => {
      console.log('[callService] Received call:video:accepted event:', data);
      notifyCallbacks('call:video:accepted', data);
    });

    commSocket.on('call:video:declined', (data) => {
      console.log('[callService] Received call:video:declined event:', data);
      notifyCallbacks('call:video:declined', data);
    });

    // Unmatch event (when either user unmatches)
    commSocket.on('match:unmatched', (data) => {
      notifyCallbacks('match:unmatched', data);
    });

    // Skip/next event (when the other user skips)
    commSocket.on('match:skipped', (data) => {
      notifyCallbacks('match:skipped', data);
    });
    
    console.log('[callService] Communication socket event handlers set up successfully');
  } catch (error) {
    console.error('Failed to setup communication socket handlers:', error);
  }
};

const ensureCommSocket = async () => {
  await setupCommEventHandlers();
  const commSocket = getCommSocket();
  if (!commSocket?.connected) {
    console.warn('Communication socket not connected for call event');
    return null;
  }
  return commSocket;
};

/**
 * Setup call event handlers
 */
const setupCallEventHandlers = () => {
  if (!callSocket) return;

  // Room joined
  callSocket.on('joined-room', (data) => {
    console.log('Joined call room:', data);
    currentCallState.roomId = data.roomId;
    currentCallState.status = 'connecting';
    notifyCallbacks('joined-room', data);
  });

  // Call started (both participants joined)
  callSocket.on('call-started', (data) => {
    console.log('Call started:', data);
    currentCallState.status = 'connected';
    currentCallState.participants = data.participants;
    currentCallState.startTime = new Date();
    notifyCallbacks('call-started', data);
  });

  // WebRTC signal received
  callSocket.on('webrtc-signal', (signal) => {
    console.log('WebRTC signal received:', signal.type);
    notifyCallbacks('webrtc-signal', signal);
  });

  // Video request received (for female users)
  callSocket.on('video-requested', (data) => {
    console.log('Video requested:', data);
    currentCallState.videoRequestPending = true;
    notifyCallbacks('video-requested', data);
  });

  // Video request sent confirmation (for male users)
  callSocket.on('video-request-sent', (data) => {
    console.log('Video request sent:', data);
    notifyCallbacks('video-request-sent', data);
  });

  // Video enabled
  callSocket.on('video-enabled', (data) => {
    console.log('Video enabled:', data);
    currentCallState.isVideoEnabled = true;
    currentCallState.videoRequestPending = false;
    notifyCallbacks('video-enabled', data);
  });

  // Video rejected
  callSocket.on('video-rejected', (data) => {
    console.log('Video rejected:', data);
    currentCallState.videoRequestPending = false;
    notifyCallbacks('video-rejected', data);
  });

  // Call ended
  callSocket.on('call-ended', (data) => {
    console.log('Call ended:', data);
    currentCallState.status = 'ended';
    notifyCallbacks('call-ended', data);
    resetCallState();
  });

  // Error
  callSocket.on('error', (error) => {
    console.error('Call error:', error);
    notifyCallbacks('error', error);
  });
};

/**
 * Disconnect call socket
 */
export const disconnectCallSocket = () => {
  if (callSocket) {
    callSocket.disconnect();
    callSocket = null;
    resetCallState();
    console.log('Call socket disconnected');
  }
};

/**
 * Reset call state
 */
const resetCallState = () => {
  currentCallState = {
    roomId: null,
    status: 'idle',
    isVideoEnabled: false,
    videoRequestPending: false,
    participants: [],
    startTime: null,
  };
  currentRoom = null;
};

/**
 * Get current call state
 */
export const getCallState = () => ({ ...currentCallState });

/**
 * Check if call socket is connected
 */
export const isCallConnected = () => callSocket?.connected || false;

// ==================== Call Actions ====================

/**
 * Join a call room
 */
export const joinCallRoom = (roomId) => {
  if (!callSocket?.connected) {
    console.warn('Call socket not connected');
    return false;
  }

  currentRoom = roomId;
  callSocket.emit('join-room', roomId);
  console.log('Joining call room:', roomId);
  return true;
};

/**
 * Leave/end call
 */
export const endCall = (roomId = currentRoom) => {
  if (!callSocket?.connected || !roomId) {
    console.warn('Cannot end call - socket not connected or no room');
    return false;
  }

  callSocket.emit('end-call', roomId);
  console.log('Ending call in room:', roomId);
  return true;
};

/**
 * Send WebRTC signal (offer/answer/ice-candidate)
 */
export const sendWebRTCSignal = (signal) => {
  if (!callSocket?.connected || !currentRoom) {
    console.warn('Cannot send signal - socket not connected or not in room');
    return false;
  }

  callSocket.emit('webrtc-signal', {
    ...signal,
    roomId: currentRoom,
  });
  return true;
};

/**
 * Request video (male user action)
 */
export const requestVideo = (userId) => {
  if (!callSocket?.connected || !currentRoom) {
    console.warn('Cannot request video - socket not connected or not in room');
    return false;
  }

  callSocket.emit('request-video', {
    roomId: currentRoom,
    userId,
  });
  console.log('Requesting video in room:', currentRoom);
  return true;
};

/**
 * Accept video request (female user action)
 */
export const acceptVideo = (userId) => {
  if (!callSocket?.connected || !currentRoom) {
    console.warn('Cannot accept video - socket not connected or not in room');
    return false;
  }

  callSocket.emit('accept-video', {
    roomId: currentRoom,
    userId,
  });
  console.log('Accepting video in room:', currentRoom);
  return true;
};

/**
 * Reject video request (female user action)
 */
export const rejectVideo = (userId) => {
  if (!callSocket?.connected || !currentRoom) {
    console.warn('Cannot reject video - socket not connected or not in room');
    return false;
  }

  callSocket.emit('reject-video', {
    roomId: currentRoom,
    userId,
  });
  console.log('Rejecting video in room:', currentRoom);
  return true;
};

export const requestHeartMatch = async ({ toUserId, roomId, sessionId }) => {
  const commSocket = await ensureCommSocket();
  if (!commSocket || !roomId || !toUserId) {
    console.warn('Cannot request heart match - missing socket/roomId/toUserId');
    return false;
  }
  commSocket.emit('call:heart:request', { toUserId, roomId, sessionId });
  return true;
};

export const acceptHeartMatch = async ({ fromUserId, toUserId, roomId, sessionId }) => {
  const commSocket = await ensureCommSocket();
  if (!commSocket || !roomId) {
    console.warn('Cannot accept heart match - missing socket/roomId');
    return false;
  }
  commSocket.emit('call:heart:accept', { fromUserId, toUserId, roomId, sessionId });
  return true;
};

export const unmatchHeart = async ({ toUserId, roomId, sessionId }) => {
  const commSocket = await ensureCommSocket();
  if (!commSocket) {
    console.warn('Cannot unmatch - missing socket');
    return false;
  }
  commSocket.emit('match:unmatch', { toUserId, roomId, sessionId });
  return true;
};

export const skipToNextMatch = async ({ toUserId, roomId, sessionId }) => {
  const commSocket = await ensureCommSocket();
  if (!commSocket) {
    console.warn('Cannot skip - missing socket');
    return false;
  }
  commSocket.emit('match:skip', { toUserId, roomId, sessionId });
  return true;
};

export const requestVideoUpgrade = async ({ toUserId, roomId, sessionId, fromUserId }) => {
  const commSocket = await ensureCommSocket();
  if (!commSocket || !roomId || !toUserId) {
    console.warn('Cannot request video - missing socket/roomId/toUserId', {
      hasSocket: !!commSocket,
      hasRoomId: !!roomId,
      hasToUserId: !!toUserId,
      socketConnected: commSocket?.connected,
    });
    return false;
  }
  
  if (!commSocket.connected) {
    console.warn('Communication socket not connected, cannot send video request');
    return false;
  }
  
  console.log('[callService] Sending call:video:request:', {
    toUserId,
    roomId,
    sessionId,
    fromUserId,
  });
  
  commSocket.emit('call:video:request', { toUserId, roomId, sessionId, fromUserId });
  return true;
};

export const acceptVideoUpgrade = async ({ fromUserId, toUserId, roomId, sessionId }) => {
  const commSocket = await ensureCommSocket();
  if (!commSocket || !roomId) {
    console.warn('Cannot accept video - missing socket/roomId');
    return false;
  }
  commSocket.emit('call:video:accept', { fromUserId, toUserId, roomId, sessionId });
  return true;
};

export const declineVideoUpgrade = async ({ fromUserId, toUserId, roomId, sessionId }) => {
  const commSocket = await ensureCommSocket();
  if (!commSocket || !roomId) {
    console.warn('Cannot decline video - missing socket/roomId');
    return false;
  }
  commSocket.emit('call:video:decline', { fromUserId, toUserId, roomId, sessionId });
  return true;
};

/**
 * Send quality report
 */
export const sendQualityReport = (report) => {
  if (!callSocket?.connected || !currentRoom) {
    return false;
  }

  callSocket.emit('quality-report', {
    ...report,
    roomId: currentRoom,
  });
  return true;
};

// ==================== Event Subscription ====================

/**
 * Subscribe to call events
 */
export const onCallEvent = (eventName, callback) => {
  if (!callEventCallbacks.has(eventName)) {
    callEventCallbacks.set(eventName, new Set());
  }
  callEventCallbacks.get(eventName).add(callback);

  // Return unsubscribe function
  return () => {
    callEventCallbacks.get(eventName)?.delete(callback);
  };
};

/**
 * Notify all callbacks for an event
 */
const notifyCallbacks = (eventName, data) => {
  const callbacks = callEventCallbacks.get(eventName);
  if (callbacks) {
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in call event callback for ${eventName}:`, error);
      }
    });
  }
};

/**
 * Remove all event listeners
 */
export const removeAllCallListeners = () => {
  callEventCallbacks.clear();
};

// ==================== Utility Functions ====================

/**
 * Calculate call duration in seconds
 */
export const getCallDuration = () => {
  if (!currentCallState.startTime) return 0;
  return Math.floor((new Date() - currentCallState.startTime) / 1000);
};

/**
 * Format call duration as MM:SS
 */
export const formatCallDuration = (seconds = getCallDuration()) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default {
  initializeCallSocket,
  disconnectCallSocket,
  getCallState,
  isCallConnected,
  joinCallRoom,
  endCall,
  sendWebRTCSignal,
  requestVideo,
  acceptVideo,
  rejectVideo,
  requestHeartMatch,
  acceptHeartMatch,
  requestVideoUpgrade,
  acceptVideoUpgrade,
  declineVideoUpgrade,
  sendQualityReport,
  onCallEvent,
  removeAllCallListeners,
  getCallDuration,
  formatCallDuration,
};
