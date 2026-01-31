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
  const [callStatuses, setCallStatuses] = useState(new Map()); // Track call statuses: { conversationId:userId -> 'receiving_call' | 'missed_call' | null }

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
    setCallStatuses(new Map());
  };

  const setupGlobalListeners = () => {
    // Listen for typing events
    onTypingStart((data) => {
      console.log('[SocketContext] Typing start received:', data);
      setTypingUsers((prev) => {
        const next = new Map(prev);
        // Use sessionId as fallback for conversationId
        const conversationId = data.conversationId || data.sessionId;
        if (conversationId && data.userId) {
          const key = `${conversationId}:${data.userId}`;
          console.log('[SocketContext] Setting typing user with key:', key);
          next.set(key, { ...data, timestamp: Date.now() });
        }
        return next;
      });

      // Auto-remove typing after 5 seconds
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          const conversationId = data.conversationId || data.sessionId;
          if (conversationId && data.userId) {
            const key = `${conversationId}:${data.userId}`;
            console.log('[SocketContext] Auto-removing typing user with key:', key);
            next.delete(key);
          }
          return next;
        });
      }, 5000);
    });

    onTypingStop((data) => {
      console.log('[SocketContext] Typing stop received:', data);
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const conversationId = data.conversationId || data.sessionId;
        if (conversationId && data.userId) {
          const key = `${conversationId}:${data.userId}`;
          console.log('[SocketContext] Removing typing user with key:', key);
          next.delete(key);
        }
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
      const possibleIds = new Set(
        [
          data.conversationId,
          data.roomId,
          data?.metadata?.sessionId,
          data?.metadata?.roomId,
        ].filter(Boolean)
      );

      console.log('[SocketContext] Message received:', {
        conversationId: data.conversationId,
        roomId: data.roomId,
        senderId: data.senderId,
        possibleIds: Array.from(possibleIds),
        registeredIds: Array.from(messageCallbacks.current.keys()),
      });

      const callbackSet = new Set();
      possibleIds.forEach((id) => {
        const cbs = messageCallbacks.current.get(id) || [];
        cbs.forEach((cb) => callbackSet.add(cb));
      });

      const callbacks = Array.from(callbackSet);
      if (callbacks.length === 0) {
        console.warn('[SocketContext] No callbacks registered for message IDs:', {
          possibleIds: Array.from(possibleIds),
          registeredIds: Array.from(messageCallbacks.current.keys()),
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

    // Listen for incoming call requests (single unified handler)
    onCallRequest((data) => {
      console.log('[SocketContext] Incoming call request received:', data);
      // Set pending call request for any screen to consume
      setPendingCallRequest(data);
      // Call all registered call request callbacks
      callRequestCallbacks.current.forEach((cb) => cb(data));
      
      // Track call status for chat list
      // Use sessionId as conversationId if conversationId is not provided
      const conversationId = data.conversationId || data.sessionId;
      if (conversationId && data.callerId) {
        const key = `${conversationId}:${data.callerId}`;
        console.log('[SocketContext] Setting call status for key:', key);
        setCallStatuses((prev) => {
          const next = new Map(prev);
          next.set(key, 'receiving_call');
          return next;
        });

        // Auto-clear after 30 seconds if not answered (mark as missed)
        setTimeout(() => {
          setCallStatuses((prev) => {
            const next = new Map(prev);
            const currentStatus = next.get(key);
            if (currentStatus === 'receiving_call') {
              console.log('[SocketContext] Call not answered, marking as missed:', key);
              next.set(key, 'missed_call');
              
              // Persist missed call to backend
              const { chatAPI } = require('../services/api');
              chatAPI.markMissedCall(conversationId).catch(err => {
                console.error('[SocketContext] Failed to persist missed call:', err);
              });
              
              // Clear missed call status after 1 minute (but keep it in database)
              setTimeout(() => {
                setCallStatuses((prev) => {
                  const next = new Map(prev);
                  next.delete(key);
                  return next;
                });
              }, 60000);
            }
            return next;
          });
        }, 30000);
      } else {
        console.warn('[SocketContext] Cannot track call status - missing conversationId or callerId:', {
          conversationId,
          callerId: data.callerId,
          sessionId: data.sessionId,
        });
      }
    });

    // Listen for call responses
    onCallResponse((data) => {
      console.log('[SocketContext] Call response received:', data);
      // Handle call response (accept/decline/ignore)
      // This can be used to update UI or start/stop calls
      callResponseCallbacks.current.forEach((cb) => cb(data));
      
      // Clear call status when call is accepted, declined, or ignored
      if (data.conversationId && data.callerId) {
        const key = `${data.conversationId}:${data.callerId}`;
        if (data.response === 'accept' || data.response === 'decline' || data.response === 'ignore') {
          setCallStatuses((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }
      }
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
    typingUsers,
    callStatuses,
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
