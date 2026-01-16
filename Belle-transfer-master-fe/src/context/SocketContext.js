import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  initializeSocket,
  disconnectSocket,
  isConnected,
  getSocket,
  joinConversation,
  leaveConversation,
  sendTypingStart,
  sendTypingStop,
  sendMessageSocket,
  onMessageReceived,
  onTypingStart,
  onTypingStop,
  onUserOnline,
  onUserOffline,
  onMatchReceived,
  onMatchFound,
  emitCallRequest,
  onCallRequest,
  emitCallResponse,
  onCallResponse,
  removeAllListeners,
} from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState(new Map());

  // Message callbacks for different conversations
  const messageCallbacks = useRef(new Map());

  // Match notification callbacks
  const matchCallbacks = useRef([]);

  // Call request callbacks
  const callRequestCallbacks = useRef([]);
  const callResponseCallbacks = useRef([]);

  // Pending match for screens to consume
  const [pendingMatch, setPendingMatch] = useState(null);

  // Pending call request for screens to consume
  const [pendingCallRequest, setPendingCallRequest] = useState(null);

  // Track if socket has been initialized to prevent unnecessary re-initialization
  const socketInitialized = useRef(false);
  const currentUserId = useRef(null);

  // Initialize socket when authenticated
  useEffect(() => {
    const userId = user?.id;

    // Only re-initialize if authentication state changed or user ID changed
    if (isAuthenticated && userId) {
      // Check if we need to re-initialize (different user or not initialized)
      if (currentUserId.current !== userId || !socketInitialized.current) {
        // If switching users, cleanup first
        if (currentUserId.current !== userId && currentUserId.current !== null) {
          cleanupSocket();
        }

        // Only initialize if not already connected
        if (!isConnected()) {
          initSocket();
          socketInitialized.current = true;
          currentUserId.current = userId;
        }
      }
    } else {
      // Only cleanup if actually logging out
      if (socketInitialized.current) {
        cleanupSocket();
        socketInitialized.current = false;
        currentUserId.current = null;
      }
    }

    return () => {
      // Only cleanup on unmount if not authenticated
      if (!isAuthenticated) {
        cleanupSocket();
        socketInitialized.current = false;
        currentUserId.current = null;
      }
    };
  }, [isAuthenticated, user?.id]); // Use user?.id instead of user to prevent re-initialization on profile updates

  const initSocket = async () => {
    try {
      await initializeSocket();
      const socket = getSocket();

      // Set initial connection status
      setConnected(isConnected());

      // Listen for connection events to update state
      if (socket) {
        socket.on('connect', () => {
          console.log('[SocketContext] Socket connected, updating state');
          setConnected(true);
        });

        socket.on('disconnect', () => {
          console.log('[SocketContext] Socket disconnected, updating state');
          setConnected(false);
        });

        socket.on('reconnect', () => {
          console.log('[SocketContext] Socket reconnected, updating state');
          setConnected(true);
        });
      }

      // Set up global event listeners
      setupGlobalListeners();
    } catch (error) {
      console.error('Failed to initialize socket:', error);
    }
  };

  const cleanupSocket = () => {
    const socket = getSocket();
    if (socket) {
      // Remove connection event listeners
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
    }
    removeAllListeners();
    disconnectSocket();
    setConnected(false);
    setTypingUsers(new Map());
    setOnlineUsers(new Map());
  };

  const setupGlobalListeners = () => {
    // Listen for typing events
    onTypingStart((data) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const key = `${data.conversationId}:${data.userId}`;
        next.set(key, { ...data, timestamp: Date.now() });
        return next;
      });

      // Auto-remove typing after 5 seconds
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          const key = `${data.conversationId}:${data.userId}`;
          next.delete(key);
          return next;
        });
      }, 5000);
    });

    onTypingStop((data) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const key = `${data.conversationId}:${data.userId}`;
        next.delete(key);
        return next;
      });
    });

    // Listen for online/offline events
    onUserOnline((data) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, { ...data, isOnline: true });
        return next;
      });
    });

    onUserOffline((data) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, { ...data, isOnline: false, lastSeen: data.lastSeen });
        return next;
      });
    });

    // Listen for messages
    onMessageReceived((data) => {
      console.log('[SocketContext] Message received:', {
        conversationId: data.conversationId,
        roomId: data.roomId,
        senderId: data.senderId,
        registeredIds: Array.from(messageCallbacks.current.keys())
      });

      // Try to find callbacks by conversationId first, then by roomId
      // This handles cases where frontend subscribes with sessionId but backend emits with roomId
      let callbacks = messageCallbacks.current.get(data.conversationId) || [];

      // If no callbacks found and we have a roomId, try that too
      if (callbacks.length === 0 && data.roomId && data.roomId !== data.conversationId) {
        callbacks = messageCallbacks.current.get(data.roomId) || [];
        console.log('[SocketContext] Trying roomId for callbacks:', data.roomId, 'found:', callbacks.length);
      }

      // Also check all registered IDs - if any match the conversationId or roomId, use those callbacks
      if (callbacks.length === 0) {
        messageCallbacks.current.forEach((cbs, registeredId) => {
          if (registeredId === data.conversationId || registeredId === data.roomId) {
            callbacks = cbs;
            console.log('[SocketContext] Found callbacks for registeredId:', registeredId);
          }
        });
      }

      if (callbacks.length === 0) {
        console.warn('[SocketContext] No callbacks registered for conversationId/roomId:', {
          conversationId: data.conversationId,
          roomId: data.roomId,
          registeredIds: Array.from(messageCallbacks.current.keys())
        });
      } else {
        console.log('[SocketContext] Calling', callbacks.length, 'callbacks for message');
      }

      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (error) {
          console.error('[SocketContext] Error in message callback:', error);
        }
      });
    });

    // Listen for new match notifications (legacy)
    onMatchReceived((data) => {
      console.log('[SocketContext] New match received:', data);
      // Set pending match for any screen to consume
      setPendingMatch(data);
      // Call all registered match callbacks
      matchCallbacks.current.forEach((cb) => cb(data));
    });

    // Listen for match:found events (new Omegle-style matching)
    onMatchFound((data) => {
      console.log('[SocketContext] Match found event received:', data);
      // Set pending match for any screen to consume
      setPendingMatch(data);
      // Call all registered match callbacks
      matchCallbacks.current.forEach((cb) => cb(data));
    });

    // Listen for incoming call requests
    onCallRequest((data) => {
      console.log('[SocketContext] Incoming call request:', data);
      // Set pending call request for any screen to consume
      setPendingCallRequest(data);
      // Call all registered call request callbacks
      callRequestCallbacks.current.forEach((cb) => cb(data));
    });

    // Listen for call responses
    onCallResponse((data) => {
      console.log('[SocketContext] Call response received:', data);
      // Handle call response (accept/decline/ignore)
      // This can be used to update UI or start/stop calls
      callResponseCallbacks.current.forEach((cb) => cb(data));
    });
  };

  // Register a callback for call responses
  const subscribeToCallResponses = useCallback((callback) => {
    callResponseCallbacks.current.push(callback);

    // Return unsubscribe function
    return () => {
      const index = callResponseCallbacks.current.indexOf(callback);
      if (index > -1) {
        callResponseCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  // Register a callback for messages in a specific conversation
  const subscribeToMessages = useCallback((conversationId, callback) => {
    console.log('[SocketContext] Subscribing to messages for conversationId:', conversationId);
    const callbacks = messageCallbacks.current.get(conversationId) || [];
    callbacks.push(callback);
    messageCallbacks.current.set(conversationId, callbacks);
    console.log('[SocketContext] Total callbacks for', conversationId, ':', callbacks.length);

    // Return unsubscribe function
    return () => {
      console.log('[SocketContext] Unsubscribing from messages for conversationId:', conversationId);
      const cbs = messageCallbacks.current.get(conversationId) || [];
      const index = cbs.indexOf(callback);
      if (index > -1) {
        cbs.splice(index, 1);
        messageCallbacks.current.set(conversationId, cbs);
      }
    };
  }, []);

  // Register a callback for match notifications
  const subscribeToMatches = useCallback((callback) => {
    matchCallbacks.current.push(callback);

    // Return unsubscribe function
    return () => {
      const index = matchCallbacks.current.indexOf(callback);
      if (index > -1) {
        matchCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  // Register a callback for call request notifications
  const subscribeToCallRequests = useCallback((callback) => {
    callRequestCallbacks.current.push(callback);

    // Return unsubscribe function
    return () => {
      const index = callRequestCallbacks.current.indexOf(callback);
      if (index > -1) {
        callRequestCallbacks.current.splice(index, 1);
      }
    };
  }, []);

  // Clear pending call request after it's been handled
  const clearPendingCallRequest = useCallback(() => {
    setPendingCallRequest(null);
  }, []);

  // Clear pending match after it's been handled
  const clearPendingMatch = useCallback(() => {
    setPendingMatch(null);
  }, []);

  // Check if a user is currently typing in a conversation
  const isUserTyping = useCallback(
    (conversationId, userId) => {
      const key = `${conversationId}:${userId}`;
      return typingUsers.has(key);
    },
    [typingUsers]
  );

  // Get all typing users in a conversation
  const getTypingUsersInConversation = useCallback(
    (conversationId) => {
      const typing = [];
      typingUsers.forEach((data, key) => {
        if (key.startsWith(`${conversationId}:`)) {
          typing.push(data);
        }
      });
      return typing;
    },
    [typingUsers]
  );

  // Check if a user is online
  const isUserOnline = useCallback(
    (userId) => {
      const data = onlineUsers.get(userId);
      return data?.isOnline || false;
    },
    [onlineUsers]
  );

  // Get user's last seen time
  const getUserLastSeen = useCallback(
    (userId) => {
      const data = onlineUsers.get(userId);
      return data?.lastSeen || null;
    },
    [onlineUsers]
  );

  const value = {
    connected,
    // Actions
    joinConversation,
    leaveConversation,
    sendTypingStart,
    sendTypingStop,
    sendMessageSocket,
    subscribeToMessages,
    // Match notification helpers
    subscribeToMatches,
    pendingMatch,
    clearPendingMatch,
    // Call request helpers
    emitCallRequest,
    emitCallResponse,
    subscribeToCallRequests,
    subscribeToCallResponses,
    pendingCallRequest,
    clearPendingCallRequest,
    // Typing helpers
    isUserTyping,
    getTypingUsersInConversation,
    typingUsers,
    // Online status helpers
    isUserOnline,
    getUserLastSeen,
    onlineUsers,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
