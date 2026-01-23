import { io } from 'socket.io-client';
import { config } from './config';
import { tokenStorage } from './api';

/**
 * WebRTC Call Service
 * Handles video/voice calls using Socket.IO signaling with the backend interaction-service
 */

// Call socket instance (separate from chat socket)
let callSocket = null;

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

    // Socket event handlers
    callSocket.on('connect', () => {
      console.log('Call socket connected:', callSocket.id);
      // Authenticate with the server
      callSocket.emit('authenticate', { token, gender: userGender });
    });

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

    return callSocket;
  } catch (error) {
    console.error('Failed to initialize call socket:', error);
    return null;
  }
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
  sendQualityReport,
  onCallEvent,
  removeAllCallListeners,
  getCallDuration,
  formatCallDuration,
};
