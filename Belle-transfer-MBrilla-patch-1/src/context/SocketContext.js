import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  initializeSocket,
  disconnectSocket,
  isConnected,
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

  // Initialize socket when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      initSocket();
    } else {
      cleanupSocket();
    }

    return () => {
      cleanupSocket();
    };
  }, [isAuthenticated, user]);

  const initSocket = async () => {
    try {
      await initializeSocket();
      setConnected(isConnected());

      // Set up global event listeners
      setupGlobalListeners();
    } catch (error) {
      console.error('Failed to initialize socket:', error);
    }
  };

  const cleanupSocket = () => {
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
      // Call all registered callbacks for this conversation
      const callbacks = messageCallbacks.current.get(data.conversationId) || [];
      callbacks.forEach((cb) => cb(data));
    });
  };

  // Register a callback for messages in a specific conversation
  const subscribeToMessages = useCallback((conversationId, callback) => {
    const callbacks = messageCallbacks.current.get(conversationId) || [];
    callbacks.push(callback);
    messageCallbacks.current.set(conversationId, callbacks);

    // Return unsubscribe function
    return () => {
      const cbs = messageCallbacks.current.get(conversationId) || [];
      const index = cbs.indexOf(callback);
      if (index > -1) {
        cbs.splice(index, 1);
        messageCallbacks.current.set(conversationId, cbs);
      }
    };
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
