import { io } from 'socket.io-client';
import { config } from './config';
import { tokenStorage } from './api';

// Socket instance
let socket = null;

// Event listeners storage
const listeners = new Map();

/**
 * Initialize socket connection with authentication
 */
export const initializeSocket = async () => {
  // If socket exists and is connected, return it
  if (socket?.connected) {
    console.log('Socket already connected');
    return socket;
  }

  // If socket exists but not connected, try to reconnect instead of creating new
  if (socket && !socket.connected) {
    console.log('Socket exists but not connected, attempting to reconnect...');
    socket.connect();
    return socket;
  }

  try {
    const token = await tokenStorage.getToken();

    if (!token) {
      console.log('No token available for socket connection');
      return null;
    }

    socket = io(config.WS_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Connection handlers
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error.message);
    });

    return socket;
  } catch (error) {
    console.error('Failed to initialize socket:', error);
    return null;
  }
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
    console.log('Socket disconnected and cleaned up');
  }
};

/**
 * Get current socket instance
 */
export const getSocket = () => socket;

/**
 * Check if socket is connected
 */
export const isConnected = () => socket?.connected || false;

// ==================== Conversation/Room Events ====================

/**
 * Join a conversation room
 */
export const joinConversation = (conversationId) => {
  if (!socket) {
    console.warn('[socket.js] Socket not initialized, cannot join conversation:', conversationId);
    return;
  }

  if (!socket.connected) {
    console.warn('[socket.js] Socket not connected, cannot join conversation:', conversationId, {
      socketId: socket.id,
      connected: socket.connected
    });
    return;
  }

  console.log('[socket.js] Emitting conversation:join event:', conversationId, {
    socketId: socket.id,
    connected: socket.connected
  });
  socket.emit('conversation:join', { conversationId });
  console.log('[socket.js] conversation:join event emitted for:', conversationId);
};

/**
 * Leave a conversation room
 */
export const leaveConversation = (conversationId) => {
  if (!socket?.connected) {
    return;
  }

  socket.emit('conversation:leave', { conversationId });
  console.log('Leaving conversation:', conversationId);
};

// ==================== Typing Events ====================

/**
 * Send typing start indicator
 */
export const sendTypingStart = (conversationId, sessionId = null) => {
  if (!socket?.connected) return;
  socket.emit('typing:start', { conversationId, sessionId });
};

/**
 * Send typing stop indicator
 */
export const sendTypingStop = (conversationId, sessionId = null) => {
  if (!socket?.connected) return;
  socket.emit('typing:stop', { conversationId, sessionId });
};

// ==================== Message Events ====================

/**
 * Send a message via socket (for real-time delivery)
 */
export const sendMessageSocket = (conversationId, content, type = 'TEXT', metadata = null) => {
  if (!socket?.connected) {
    console.warn('Socket not connected, cannot send message');
    return false;
  }

  socket.emit('message:send', {
    conversationId,
    content,
    type,
    metadata,
  });

  return true;
};

// ==================== Voice Events ====================

/**
 * Send voice recording start
 */
export const sendVoiceStart = (conversationId) => {
  if (!socket?.connected) return;
  socket.emit('voice:start', { conversationId });
};

/**
 * Send voice recording stop
 */
export const sendVoiceStop = (conversationId) => {
  if (!socket?.connected) return;
  socket.emit('voice:stop', { conversationId });
};

// ==================== Event Listeners ====================

/**
 * Subscribe to message received events
 */
export const onMessageReceived = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('message:received', handler);
  listeners.set('message:received', handler);

  return () => {
    socket?.off('message:received', handler);
    listeners.delete('message:received');
  };
};

/**
 * Subscribe to typing start events
 */
export const onTypingStart = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('typing:start', handler);
  listeners.set('typing:start', handler);

  return () => {
    socket?.off('typing:start', handler);
    listeners.delete('typing:start');
  };
};

/**
 * Subscribe to typing stop events
 */
export const onTypingStop = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('typing:stop', handler);
  listeners.set('typing:stop', handler);

  return () => {
    socket?.off('typing:stop', handler);
    listeners.delete('typing:stop');
  };
};

/**
 * Subscribe to user online events
 */
export const onUserOnline = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('user:online', handler);
  listeners.set('user:online', handler);

  return () => {
    socket?.off('user:online', handler);
    listeners.delete('user:online');
  };
};

/**
 * Subscribe to user offline events
 */
export const onUserOffline = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('user:offline', handler);
  listeners.set('user:offline', handler);

  return () => {
    socket?.off('user:offline', handler);
    listeners.delete('user:offline');
  };
};

/**
 * Subscribe to user joined conversation events
 */
export const onUserJoined = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('user:joined', handler);
  listeners.set('user:joined', handler);

  return () => {
    socket?.off('user:joined', handler);
    listeners.delete('user:joined');
  };
};

/**
 * Subscribe to user left conversation events
 */
export const onUserLeft = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('user:left', handler);
  listeners.set('user:left', handler);

  return () => {
    socket?.off('user:left', handler);
    listeners.delete('user:left');
  };
};

/**
 * Subscribe to voice started events
 */
export const onVoiceStarted = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('voice:started', handler);
  listeners.set('voice:started', handler);

  return () => {
    socket?.off('voice:started', handler);
    listeners.delete('voice:started');
  };
};

/**
 * Subscribe to voice stopped events
 */
export const onVoiceStopped = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('voice:stopped', handler);
  listeners.set('voice:stopped', handler);

  return () => {
    socket?.off('voice:stopped', handler);
    listeners.delete('voice:stopped');
  };
};

/**
 * Subscribe to new match notification events
 */
export const onMatchFound = (callback) => {
  if (!socket) {
    console.warn('Socket not initialized, cannot listen for match:found events');
    return () => {};
  }

  const eventName = 'match:found';
  const listener = (data) => {
    console.log('[Socket] match:found event received:', data);
    callback(data);
  };

  socket.on(eventName, listener);

  // Store listener for cleanup
  if (!listeners.has(eventName)) {
    listeners.set(eventName, []);
  }
  listeners.get(eventName).push({ callback, listener });

  // Return unsubscribe function
  return () => {
    socket.off(eventName, listener);
    const eventListeners = listeners.get(eventName);
    if (eventListeners) {
      const index = eventListeners.findIndex((l) => l.callback === callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  };
};

export const onMatchReceived = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    console.log('[Socket] Match notification received:', data);
    callback(data);
  };

  socket.on('match:new', handler);
  listeners.set('match:new', handler);

  return () => {
    socket?.off('match:new', handler);
    listeners.delete('match:new');
  };
};

/**
 * Emit call request to a user
 */
export const emitCallRequest = (userId, callData) => {
  if (!socket || !socket.connected) {
    console.error('Socket not connected, cannot send call request');
    return false;
  }

  socket.emit('call:request', {
    toUserId: userId,
    ...callData,
  });
  return true;
};

/**
 * Subscribe to incoming call request events
 */
export const onCallRequest = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    console.log('[socket.js] call:request received:', data);
    callback(data);
  };

  socket.on('call:request', handler);
  listeners.set('call:request', handler);

  return () => {
    socket?.off('call:request', handler);
    listeners.delete('call:request');
  };
};

/**
 * Emit call response (accept/decline/ignore)
 */
export const emitCallResponse = (callId, response, responderName = null) => {
  if (!socket || !socket.connected) {
    console.error('Socket not connected, cannot send call response');
    return false;
  }

  socket.emit('call:response', {
    callId,
    response, // 'accept', 'decline', 'ignore'
    responderName,
  });
  return true;
};

/**
 * Subscribe to call response events
 */
export const onCallResponse = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('call:response', handler);
  listeners.set('call:response', handler);

  return () => {
    socket?.off('call:response', handler);
    listeners.delete('call:response');
  };
};

/**
 * Subscribe to error events
 */
export const onError = (callback) => {
  if (!socket) return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('error', handler);
  listeners.set('error', handler);

  return () => {
    socket?.off('error', handler);
    listeners.delete('error');
  };
};

/**
 * Remove all listeners
 */
export const removeAllListeners = () => {
  if (!socket) return;

  listeners.forEach((handler, event) => {
    socket.off(event, handler);
  });

  listeners.clear();
};

export default {
  initializeSocket,
  disconnectSocket,
  getSocket,
  isConnected,
  joinConversation,
  leaveConversation,
  sendTypingStart,
  sendTypingStop,
  sendMessageSocket,
  sendVoiceStart,
  sendVoiceStop,
  onMessageReceived,
  onTypingStart,
  onTypingStop,
  onUserOnline,
  onUserOffline,
  onUserJoined,
  onUserLeft,
  onVoiceStarted,
  onVoiceStopped,
  onMatchReceived,
  onMatchFound,
  emitCallRequest,
  onCallRequest,
  emitCallResponse,
  onCallResponse,
  onError,
  removeAllListeners,
};
