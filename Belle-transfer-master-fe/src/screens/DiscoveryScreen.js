import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useCallContext } from '../navigation/AppNavigator';
import {
  ScreenHeader,
  DiscoveryParameter,
  MatchingView,
  VerificationBlockingModal,
} from '../components';
import CallView from '../../CallView';
import FiltersModal from '../components/FiltersModal';
import filterIcon from '../../assets/filter.png';
import { queueAPI, sessionAPI, preferencesAPI, userAPI, notificationAPI, matchAPI, chatAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { CallNotification } from '../components';
import { getSubscriptionStatus } from '../services/iap';
import { skipToNextMatch } from '../services/callService';

const { width } = Dimensions.get('window');

export default function DiscoveryScreen({ navigation, route }) {
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [isFindingMatch, setIsFindingMatch] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [queueStatus, setQueueStatus] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [showNoUsersFound, setShowNoUsersFound] = useState(false);
  const [matchingStartTime, setMatchingStartTime] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [newMatch, setNewMatch] = useState(null);
  const [processingMatch, setProcessingMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [matchedUserId, setMatchedUserId] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [callNotificationVisible, setCallNotificationVisible] = useState(false);
  const [incomingCallRequest, setIncomingCallRequest] = useState(null);
  const [suggestedProfiles, setSuggestedProfiles] = useState([]);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const { isInCall, setIsInCall } = useCallContext();
  const callStartTime = useRef(null);
  const timerRef = useRef(null);
  const callTimerStarted = useRef(false);
  const queuePollingRef = useRef(null);
  const notificationPollingRef = useRef(null);
  const subscriptionStatusCache = useRef({ status: null, timestamp: 0 });
  const checkPremiumStatusTimeoutRef = useRef(null);
  const matchHandlingRef = useRef(false);

  // Socket for real-time match notifications and call requests
  const {
    subscribeToMatches,
    pendingMatch,
    clearPendingMatch,
    emitCallRequest,
    emitCallResponse,
    subscribeToCallRequests,
    pendingCallRequest,
    clearPendingCallRequest,
  } = useSocket();

  // Filter states - these are temporary and only used for matching
  // They are initialized from preferences but changes don't save back to preferences
  const [intent, setIntent] = useState('Dating');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(45);
  const [distance, setDistance] = useState(50);
  const [lookingFor, setLookingFor] = useState('Any');
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);
  const [instantConnect, setInstantConnect] = useState(false);
  const [myLocation, setMyLocation] = useState('Ontario, California, United States');

  // Track if preferences have been loaded to avoid overwriting user's filter changes
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Dummy location for other users (this is what we're discovering)
  const otherUserLocation = 'Los Angeles, CA, USA';

  // Load preferences and profile data on mount and when screen comes into focus
  useEffect(() => {
    loadPreferencesAndProfile();
    checkPremiumStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check premium status with caching and debouncing
  const checkPremiumStatus = async (forceRefresh = false) => {
    // Check cache first (cache for 30 seconds to prevent rate limiting)
    const cacheAge = Date.now() - subscriptionStatusCache.current.timestamp;
    const CACHE_DURATION = 30000; // 30 seconds
    
    if (!forceRefresh && subscriptionStatusCache.current.status !== null && cacheAge < CACHE_DURATION) {
      const cachedStatus = subscriptionStatusCache.current.status;
      setIsPremiumUser(cachedStatus);
      return cachedStatus;
    }
    
    try {
      const status = await getSubscriptionStatus();
      
      const isActive = status?.subscription?.status === 'ACTIVE';
      
      // Update cache
      subscriptionStatusCache.current = {
        status: isActive,
        timestamp: Date.now()
      };
      
      if (isActive) {
        setIsPremiumUser(true);
        return true;
      } else {
        setIsPremiumUser(false);
        return false;
      }
    } catch (error) {
      
      // If rate limited, use cached value if available
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        if (subscriptionStatusCache.current.status !== null) {
          const cachedStatus = subscriptionStatusCache.current.status;
          setIsPremiumUser(cachedStatus);
          return cachedStatus;
        }
      }
      
      setIsPremiumUser(false);
      return false;
    }
  };

  // Reload preferences when screen comes into focus (e.g., after saving preferences)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Clear any pending timeout
      if (checkPremiumStatusTimeoutRef.current) {
        clearTimeout(checkPremiumStatusTimeoutRef.current);
      }
      
      // Check premium status when screen comes into focus (in case user just subscribed)
      // Use cache if available, check immediately (no debounce)
      checkPremiumStatus(false); // Don't force refresh, use cache if available
      
      // Reset preferencesLoaded flag to allow reloading from backend
      setPreferencesLoaded(false);
      loadPreferencesAndProfile();
    });
    return () => {
      if (checkPremiumStatusTimeoutRef.current) {
        clearTimeout(checkPremiumStatusTimeoutRef.current);
      }
      unsubscribe();
    };
  }, [navigation]);

  // Check for refreshPremium param to force premium status refresh
  useEffect(() => {
    if (route?.params?.refreshPremium) {
      checkPremiumStatus(true); // Force refresh when explicitly requested
      // Clear the param to avoid repeated checks
      navigation.setParams({ refreshPremium: false });
    }
  }, [route?.params?.refreshPremium]);

  // Also reload when route params indicate refresh is needed
  useEffect(() => {
    if (route?.params?.refreshFilters) {
      setPreferencesLoaded(false);
      loadPreferencesAndProfile();
      // Clear the refresh flag
      navigation.setParams({ refreshFilters: false });
    }
  }, [route?.params?.refreshFilters]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopQueuePolling();
      stopNotificationPolling();
    };
  }, []);

  const resolvePartnerProfile = useCallback(async (data, partnerId) => {
    let partnerProfile = null;

    if (data?.partnerProfile && typeof data.partnerProfile === 'object') {
      const preferenceKeys = [
        'educationLevel',
        'religion',
        'familyPlans',
        'hasKids',
        'languages',
        'ethnicity',
        'politicalViews',
        'exercise',
        'smoking',
        'drinking',
      ];
      const hasPreferences = preferenceKeys.some((key) => {
        const value = data.partnerProfile?.[key];
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return value !== null && value !== undefined && value !== '';
      });

      if (hasPreferences) {
        console.log('[DiscoveryScreen] Using full profile data from event');
        return { id: partnerId, ...data.partnerProfile };
      }

      console.log('[DiscoveryScreen] Event profile missing preferences, fetching full profile');
    }

    let retries = 3;
    let lastError = null;

    while (retries > 0) {
      try {
        partnerProfile = await userAPI.getUser(partnerId);
        console.log('[DiscoveryScreen] Fetched partner profile:', partnerProfile?.name || 'Unknown');
        break;
      } catch (profileError) {
        lastError = profileError;
        retries--;
        console.warn(`[DiscoveryScreen] Failed to fetch partner profile (${retries} retries left):`, profileError);
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * (3 - retries)));
        }
      }
    }

    if (!partnerProfile) {
      console.warn('[DiscoveryScreen] All profile fetch attempts failed, using event data:', lastError);
      partnerProfile = {
        id: partnerId,
        name: data?.partnerName || 'Someone',
        profilePicture: data?.partnerProfilePicture || null,
        bio: null,
        photos: null,
        interests: null
      };
    }

    return partnerProfile;
  }, []);

  const handleMatchFound = useCallback(async (data) => {
    if (matchHandlingRef.current) {
      console.log('[DiscoveryScreen] Match handling already in progress, ignoring');
      return;
    }

    matchHandlingRef.current = true;
    setProcessingMatch(true);

    try {
      console.log('[DiscoveryScreen] match:found event received:', data);

      stopNotificationPolling();
      stopQueuePolling();
      setIsFindingMatch(false);

      const partnerId = data?.partnerId;
      const sessionId = data?.sessionId;
      const roomId = data?.roomId;

      console.log('[DiscoveryScreen] match:found event data:', {
        partnerId,
        sessionId,
        roomId,
        partnerName: data?.partnerName,
        hasProfilePicture: !!data?.partnerProfilePicture
      });

      if (!partnerId) {
        console.error('[DiscoveryScreen] No partnerId in match:found event');
        clearPendingMatch();
        return;
      }

      if (!sessionId || !roomId) {
        console.log('[DiscoveryScreen] Ignoring match:found event without sessionId/roomId (this is a PROPOSED match, not a call session):', {
          sessionId,
          roomId,
          matchId: data?.matchId
        });
        clearPendingMatch();
        return;
      }

      const partnerProfile = await resolvePartnerProfile(data, partnerId);

      setMatchedUser(partnerProfile);
      setMatchedUserId(partnerId);
      setMatchId(data?.matchId);
      setCurrentSession({ 
        id: sessionId || null, 
        roomId: roomId || null, 
        partnerId 
      });

      setIsInCall(true);
      clearPendingMatch();

      console.log('[DiscoveryScreen] Auto-showing CallView for match:', {
        partnerId,
        partnerName: partnerProfile?.name || data?.partnerName,
        sessionId,
        roomId
      });
    } catch (error) {
      console.error('[DiscoveryScreen] Error processing match:found event:', error);
      Alert.alert('Error', 'Failed to load match. Please try again.');
    } finally {
      matchHandlingRef.current = false;
      setProcessingMatch(false);
    }
  }, [
    clearPendingMatch,
    resolvePartnerProfile,
    setIsFindingMatch,
    setIsInCall,
    setMatchedUser,
    setMatchedUserId,
    setMatchId,
    setCurrentSession,
    stopNotificationPolling,
    stopQueuePolling,
  ]);

  // Listen for match:found events (Omegle-style automatic matching)
  useEffect(() => {
    if (isInCall || matchModalVisible) return;

    const unsubscribe = subscribeToMatches((data) => {
      handleMatchFound(data);
    });

    return unsubscribe;
  }, [isInCall, matchModalVisible, subscribeToMatches, handleMatchFound]);

  // Also check for pending match from socket context (in case it arrived while screen was unmounted)
  useEffect(() => {
    // For Omegle-style flow, skip modal and go directly to CallView
    if (pendingMatch && !isInCall) {
      console.log('[DiscoveryScreen] Found pending match from socket:', pendingMatch);
      stopNotificationPolling();
      stopQueuePolling();

      const partnerId = pendingMatch.partnerId || pendingMatch.userId;

      setNewMatch({
        matchId: pendingMatch.matchId,
        partnerName: pendingMatch.partnerName || 'Someone',
        partnerProfilePicture: pendingMatch.partnerProfilePicture,
        matchScore: pendingMatch.matchScore,
        notificationId: pendingMatch.notificationId,
        partnerId,
      });

      if (partnerId) {
        handleMatchFound(pendingMatch);
      } else {
        clearPendingMatch();
      }
    }
  }, [pendingMatch, matchModalVisible, isInCall, clearPendingMatch, handleMatchFound]);

  const loadPreferencesAndProfile = async () => {
    try {
      // Load discovery preferences - these become the default filter values
      const prefs = await preferencesAPI.getDiscoveryPreferences();
      if (prefs) {
        // Only set if preferences haven't been loaded yet (initial load)
        // This ensures preferences are used as defaults but user's filter changes persist
        if (!preferencesLoaded) {
          setMinAge(prefs.ageMin || 18);
          setMaxAge(prefs.ageMax || 45);
          setDistance(prefs.maxDistance || 50);
          setLookingFor(prefs.interestedIn || 'Any');
          // Map connectionType to intent
          if (prefs.connectionType) {
            setIntent(prefs.connectionType);
          }
          // Load interests from preferences
          if (prefs.interests && prefs.interests.length > 0) {
            setSelectedInterests(prefs.interests);
          }
          setPreferencesLoaded(true);
        }
      }

      // Load user profile for location
      const profile = await userAPI.getProfile();
      if (profile) {
        // Only load interests from profile if not already loaded from preferences
        if (profile.interests && profile.interests.length > 0 && !preferencesLoaded && (!prefs || !prefs.interests || prefs.interests.length === 0)) {
          setSelectedInterests(profile.interests);
        }
        if (profile.location) {
          setMyLocation(profile.location);
        }
      }
    } catch (error) {
      console.error('Error loading preferences/profile:', error);
      // Use defaults if loading fails
      setPreferencesLoaded(true); // Mark as loaded even on error to prevent retries
    }
  };

  const interests = [
    { id: 'coffee', name: 'Coffee', icon: 'cafe', iconFamily: 'Ionicons' },
    { id: 'hiking', name: 'Hiking', icon: 'walk', iconFamily: 'Ionicons' },
    { id: 'travel', name: 'Travel', icon: 'airplane', iconFamily: 'Ionicons' },
    { id: 'photography', name: 'Photography', icon: 'camera', iconFamily: 'Ionicons' },
    { id: 'music', name: 'Music', icon: 'musical-notes', iconFamily: 'Ionicons' },
    { id: 'food', name: 'Food', icon: 'restaurant', iconFamily: 'Ionicons' },
    { id: 'reading', name: 'Reading', icon: 'book', iconFamily: 'Ionicons' },
    { id: 'sports', name: 'Sports', icon: 'football', iconFamily: 'Ionicons' },
    { id: 'art', name: 'Art', icon: 'brush', iconFamily: 'Ionicons' },
    { id: 'technology', name: 'Technology', icon: 'laptop', iconFamily: 'Ionicons' },
    { id: 'yoga', name: 'Yoga', icon: 'fitness', iconFamily: 'Ionicons' },
    { id: 'dancing', name: 'Dancing', icon: 'happy', iconFamily: 'Ionicons' },
  ];

  const languages = [
    { id: 'english', name: 'English', flag: '🇺🇸' },
    { id: 'spanish', name: 'Spanish', flag: '🇪🇸' },
    { id: 'french', name: 'French', flag: '🇫🇷' },
    { id: 'german', name: 'German', flag: '🇩🇪' },
    { id: 'mandarin', name: 'Mandarin', flag: '🇨🇳' },
    { id: 'japanese', name: 'Japanese', flag: '🇯🇵' },
  ];

  const startMatching = async () => {
    try {
      // Check if user is photo verified
      if (!user?.isPhotoVerified) {
        setShowVerificationModal(true);
        return;
      }

      console.log('[DiscoveryScreen] Starting matching process...');
      setIsFindingMatch(true);
      setShowNoUsersFound(false);
      setMatchingStartTime(Date.now());

      // Build preferences matching GraphQL schema (QueuePreferences input type)
      const preferences = {
        ageRange: {
          min: minAge,
          max: maxAge,
        },
        genderPreference: lookingFor === 'Any' ? null : lookingFor,
        maxDistance: distance,
        interests: selectedInterests.length > 0 ? selectedInterests : null,
        location: myLocation || null,
      };

      console.log('[DiscoveryScreen] Joining queue with preferences:', preferences);

      // Join queue instead of discovering profiles
      const queueStatus = await queueAPI.joinQueue(preferences);
      console.log('[DiscoveryScreen] Joined queue:', queueStatus);

      // Start polling for queue status (fallback if WebSocket fails)
      startQueuePolling();
    } catch (err) {
      console.error('[DiscoveryScreen] Error starting match:', err);
      console.error('[DiscoveryScreen] Error details:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
      });

      setIsFindingMatch(false);
      const errorMessage = err?.message || 'Failed to start matching';

      // Check if it's an authentication error
      if (errorMessage.includes('authenticated') || errorMessage.includes('token')) {
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Optionally navigate to login screen
                // navigation.navigate('Login');
              }
            }
          ]
        );
      } else if (errorMessage.includes('Route not found') || errorMessage.includes('404')) {
        Alert.alert(
          'Service Error',
          'The matching service is not available. Please try again later or contact support.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage.includes('Network error') || errorMessage.includes('Failed to fetch')) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the server. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
      }
    }
  };

  const startQueuePolling = () => {
    // Poll for queue status and match
    // Poll every 3 seconds (relaxed from 5 seconds)
    queuePollingRef.current = setInterval(async () => {
      try {
        const status = await queueAPI.getQueueStatus();
        setQueueStatus(status);

        // Check if we got matched (status would change or we'd have a session)
        if (status?.status === 'MATCHED') {
          stopQueuePolling();
          stopNotificationPolling();
          setShowNoUsersFound(false);
          // Immediately check for match notification
          handleMatchNotificationFound();
          return;
        }

        // Show "no users found" message after 15 seconds if still waiting
        if (matchingStartTime && status?.status === 'WAITING') {
          const elapsedSeconds = (Date.now() - matchingStartTime) / 1000;
          if (elapsedSeconds >= 15) {
            setShowNoUsersFound(true);
          }
        }
      } catch (err) {
        console.error('Error polling queue:', err);
        // If rate limited, just continue polling (relaxed - don't stop)
        // Don't stop polling on errors, keep trying
      }
    }, 3000); // Poll every 3 seconds (relaxed from 5 seconds)
  };

  // Poll for new match notifications while matching
  const startNotificationPolling = () => {
    const pollingStartTime = Date.now();
    notificationPollingRef.current = setInterval(async () => {
      try {
        if (!isFindingMatch || matchModalVisible) return; // Don't poll if not matching or modal is open

        const notifications = await notificationAPI.getNotifications(20, 0);
        console.log('[DiscoveryScreen] Polling notifications, found:', notifications.length);

        // Find match notification that:
        // 1. Is NEW_MATCH type
        // 2. Hasn't been acted upon
        // 3. Was created recently (within last 5 minutes) OR after matching started
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        const matchStartTime = matchingStartTime || pollingStartTime;

        const matchNotification = notifications.find(n => {
          if (n.type !== 'NEW_MATCH') return false;
          if (n.data?.matchActionTaken === true) return false;

          // Check if notification was created recently
          if (n.createdAt) {
            const notificationTime = new Date(n.createdAt).getTime();
            // Accept if created after matching started OR within last 5 minutes
            const isRecent = notificationTime > matchStartTime || notificationTime > fiveMinutesAgo;
            if (!isRecent) return false;
          }

          console.log('[DiscoveryScreen] Found valid match notification:', {
            id: n.id,
            matchId: n.data?.matchId,
            createdAt: n.createdAt,
            matchActionTaken: n.data?.matchActionTaken
          });
          return true;
        });

        if (matchNotification) {
          console.log('[DiscoveryScreen] New match notification found, showing modal:', matchNotification);
          stopNotificationPolling();
          stopQueuePolling();
          const partnerName = matchNotification.data?.partnerName || 'Someone';
          const matchScore = matchNotification.data?.matchScore;

          setNewMatch({
            matchId: matchNotification.data?.matchId,
            partnerName,
            partnerProfilePicture: matchNotification.data?.partnerProfilePicture,
            matchScore,
            notificationId: matchNotification.id,
          });
          // Show modal immediately - keep isFindingMatch true so modal appears on top of matching view
          setMatchModalVisible(true);
          // Don't set isFindingMatch to false here - let the modal show on top
        }
      } catch (err) {
        console.error('Error polling notifications:', err);
      }
    }, 1000); // Poll every 1 second for faster response
  };

  function stopNotificationPolling() {
    if (notificationPollingRef.current) {
      clearInterval(notificationPollingRef.current);
      notificationPollingRef.current = null;
    }
  }

  function stopQueuePolling() {
    if (queuePollingRef.current) {
      clearInterval(queuePollingRef.current);
      queuePollingRef.current = null;
    }
    stopNotificationPolling();
  }

  const handleMatchNotificationFound = async () => {
    // Check for new match notifications - try multiple times with short delays
    // because notification might not be created immediately
    const maxRetries = 10; // Increased retries
    let retryCount = 0;
    const matchStartTime = matchingStartTime || Date.now();
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

    const checkForNotification = async () => {
      try {
        console.log('[DiscoveryScreen] Match found, checking for notifications... (attempt', retryCount + 1, ')');
        const notifications = await notificationAPI.getNotifications(20, 0);
        console.log('[DiscoveryScreen] Checking', notifications.length, 'notifications');

        const matchNotification = notifications.find(n => {
          if (n.type !== 'NEW_MATCH') return false;
          if (n.data?.matchActionTaken === true) return false;

          // Check if notification was created recently
          if (n.createdAt) {
            const notificationTime = new Date(n.createdAt).getTime();
            // Accept if created after matching started OR within last 5 minutes
            const isRecent = notificationTime > matchStartTime || notificationTime > fiveMinutesAgo;
            if (!isRecent) return false;
          }

          return true;
        });

        if (matchNotification) {
          console.log('[DiscoveryScreen] Found match notification:', matchNotification);
          stopNotificationPolling();
          stopQueuePolling();
          const partnerName = matchNotification.data?.partnerName || 'Someone';
          const matchScore = matchNotification.data?.matchScore;
          const partnerId = matchNotification.data?.partnerId || matchNotification.data?.userId;

          // Set the match data
          setNewMatch({
            matchId: matchNotification.data?.matchId,
            partnerName,
            partnerProfilePicture: matchNotification.data?.partnerProfilePicture,
            matchScore,
            notificationId: matchNotification.id,
            partnerId,
          });

          // Fetch partner profile and open CallView
          if (partnerId) {
            setMatchedUserId(partnerId);
            setMatchId(matchNotification.data?.matchId);
            setIsFindingMatch(false);
            setIsInCall(true);
          } else {
            // Fallback: show modal if we can't get partner ID
            setMatchModalVisible(true);
          }
          return true;
        } else if (retryCount < maxRetries) {
          // Retry after a short delay
          retryCount++;
          setTimeout(checkForNotification, 500);
          return false;
        } else {
          // Fallback: if no notification found after retries, check for pending matches directly
          console.log('[DiscoveryScreen] No notification found after retries, checking pending matches...');
          try {
            const pendingMatches = await matchAPI.getPendingMatches();
            if (pendingMatches && pendingMatches.length > 0) {
              // Get the most recent match
              // filtered by created time to ensure it's recent? 
              // For now take the last one (assuming newest is last or first? API sorts?)
              // Ideally sort by createdAt desc
              const latestMatch = pendingMatches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

              if (latestMatch) {
                console.log('[DiscoveryScreen] Found pending match via API fallback:', latestMatch);
                stopNotificationPolling();
                stopQueuePolling();

                const partner = latestMatch.user1Id === user?.id ? latestMatch.user2 : latestMatch.user1;
                const partnerId = latestMatch.user1Id === user?.id ? latestMatch.user2Id : latestMatch.user1Id;

                setNewMatch({
                  matchId: latestMatch.id,
                  partnerName: partner?.name || 'Someone',
                  partnerProfilePicture: partner?.profilePicture,
                  matchScore: latestMatch.totalScore,
                  notificationId: null,
                  partnerId,
                });

                // Fetch partner profile and open CallView
                if (partnerId) {
                  setMatchedUserId(partnerId);
                  setMatchId(latestMatch.id);
                  setIsFindingMatch(false);
                  setIsInCall(true);
                } else {
                  setMatchModalVisible(true);
                }
                return true;
              }
            }
          } catch (matchErr) {
            console.error('[DiscoveryScreen] Error fetching pending matches:', matchErr);
          }

          // Last resort: check for active session
          console.log('[DiscoveryScreen] No pending match found, checking for session...');
          const sessions = await sessionAPI.getActiveSessions();
          if (sessions && sessions.length > 0) {
            const latestSession = sessions[0];
            const partner = latestSession.user1Id === user?.id ? latestSession.user2 : latestSession.user1;
            const partnerId = latestSession.user1Id === user?.id ? latestSession.user2Id : latestSession.user1Id;

            console.log('[DiscoveryScreen] Found active session fallback:', latestSession);

            setNewMatch({
              matchId: null,
              sessionId: latestSession.id,
              partnerName: partner?.name || 'Someone',
              partnerProfilePicture: partner?.profilePicture,
              matchScore: 0.85,
              isSessionFallback: true,
              partnerId,
            });

            // Fetch partner profile and open CallView
            if (partnerId) {
              setMatchedUserId(partnerId);
              setMatchId(null);
              setIsFindingMatch(false);
              setIsInCall(true);
            } else {
              setMatchModalVisible(true);
            }
            return true;
          }
          return false;
        }
      } catch (err) {
        console.error('Error handling match found:', err);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkForNotification, 500);
        }
        return false;
      }
    };

    await checkForNotification();
  };

  const cancelMatching = async () => {
    try {
      stopQueuePolling();
      stopNotificationPolling();
      await queueAPI.leaveQueue();
      setIsFindingMatch(false);
      setQueueStatus(null);
      setShowNoUsersFound(false);
      setMatchingStartTime(null);
    } catch (err) {
      console.error('Error canceling match:', err);
      setIsFindingMatch(false);
      setShowNoUsersFound(false);
      setMatchingStartTime(null);
    }
  };

  const handleAcceptMatch = async () => {
    if (!newMatch) {
      console.warn('[DiscoveryScreen] No match data available');
      return;
    }

    // If fallback from session (no matchId), just navigate to chat
    if (newMatch.isSessionFallback && newMatch.sessionId) {
      console.log('[DiscoveryScreen] Accepting session fallback, navigating to chat');
      const partnerId = user?.id; // In fallback we might not have partner ID readily available in result object logic below, so we need to carry it
      // Actually newMatch should have partnerId? No, we didn't store it in newMatch state explicitly, just name/pic.
      // But ActivityScreen navigation logic uses result.userXId.

      // We can just navigate to ChatConversation with sessionId. The screen loads details.
      navigation.navigate('ChatConversation', {
        sessionId: newMatch.sessionId,
        chatId: newMatch.sessionId,
        partnerName: newMatch.partnerName,
      });

      setIsFindingMatch(false);
      setMatchModalVisible(false);
      setNewMatch(null);
      return;
    }

    if (!newMatch.matchId) {
      console.warn('[DiscoveryScreen] No match ID available');
      return;
    }

    try {
      setProcessingMatch(true);
      console.log('[DiscoveryScreen] Accepting match:', newMatch.matchId);

      // Call the GraphQL mutation
      const result = await matchAPI.acceptMatch(newMatch.matchId);
      console.log('[DiscoveryScreen] Match accepted successfully:', result);

      // Mark notification as read (match action is automatically marked by backend)
      if (newMatch.notificationId) {
        try {
          await notificationAPI.markNotificationAsRead(newMatch.notificationId);
        } catch (notifError) {
          console.error('[DiscoveryScreen] Error updating notification:', notifError);
          // Don't fail the whole flow if notification update fails
        }
      }

      // Stop matching and close modal
      setIsFindingMatch(false);
      setMatchModalVisible(false);
      const matchData = newMatch;
      setNewMatch(null);
      setProcessingMatch(false);

      // Navigate directly to chat if session or chatRoomId exists
      if (result?.session?.id) {
        const partnerId = result.user1Id === user?.id ? result.user2Id : result.user1Id;
        navigation.navigate('ChatConversation', {
          sessionId: result.session.id,
          partnerId: partnerId,
          partnerName: matchData.partnerName,
        });
      } else if (result?.chatRoomId) {
        // If we have a chat room but no session, navigate to chat with room ID
        const partnerId = result.user1Id === user?.id ? result.user2Id : result.user1Id;
        navigation.navigate('ChatConversation', {
          roomId: result.chatRoomId,
          partnerId: partnerId,
          partnerName: matchData.partnerName,
        });
      } else {
        // If no session or chat room, navigate to chats
        navigation.navigate('Chats');
      }
    } catch (error) {
      console.error('[DiscoveryScreen] Error accepting match:', error);
      setProcessingMatch(false);

      const errorMessage = error?.message || 'Failed to accept match. Please try again.';
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  const handleDeclineMatch = async () => {
    if (!newMatch || !newMatch.matchId) {
      console.warn('[DiscoveryScreen] No match data available');
      return;
    }

    Alert.alert(
      'Decline Match',
      `Are you sure you want to decline the match with ${newMatch.partnerName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingMatch(true);
              console.log('[DiscoveryScreen] Declining match:', newMatch.matchId);

              // Call the GraphQL mutation
              await matchAPI.declineMatch(newMatch.matchId);
              console.log('[DiscoveryScreen] Match declined successfully');

              // Mark notification as read and mark action as taken
              if (newMatch.notificationId) {
                try {
                  await notificationAPI.markNotificationAsRead(newMatch.notificationId);
                  // Also mark match action as taken
                  if (newMatch.matchId) {
                    await notificationAPI.markMatchActionTaken(newMatch.matchId).catch(console.error);
                  }
                } catch (notifError) {
                  console.error('[DiscoveryScreen] Error updating notification:', notifError);
                  // Don't fail the whole flow if notification update fails
                }
              }

              setMatchModalVisible(false);
              setNewMatch(null);
              setProcessingMatch(false);

              // Continue matching if we were in matching mode
              if (matchingStartTime) {
                setIsFindingMatch(true);
                startQueuePolling();
                startNotificationPolling();
              } else {
                // If not matching, just close the modal
                setIsFindingMatch(false);
              }

              Alert.alert('Match Declined', 'The match has been declined. Continuing to search...');
            } catch (error) {
              console.error('[DiscoveryScreen] Error declining match:', error);
              setProcessingMatch(false);

              const errorMessage = error?.message || 'Failed to decline match. Please try again.';
              Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
            }
          },
        },
      ]
    );
  };

  // Note: Video calls can only be initiated from CallView when in an active audio call.
  // The video toggle button in CallView handles video requests/enabling.
 

  const handleMatchButton = async () => {
    if (!matchedUserId) {
      Alert.alert('Error', 'Unable to create match. User information is missing.');
      return;
    }

    try {
      console.log('[DiscoveryScreen] Creating match from suggestion:', matchedUserId);
      setProcessingMatch(true);

      // Create match immediately from suggestion
      const result = await matchAPI.createMatchFromSuggestion(matchedUserId);
      console.log('[DiscoveryScreen] Match created successfully:', result);

      // Update matchId and matched user data
      if (result) {
        setMatchId(result.id);
        // Match is already created, stay in CallView
      }

      setProcessingMatch(false);

      // Show success message
      Alert.alert(
        'Match Created!',
        `You've matched with ${matchedUser?.name || 'your match'}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Stay in CallView, match is already created
              if (result?.session?.id) {
                const partnerId = result.user1Id === user?.id ? result.user2Id : result.user1Id;
                setIsInCall(false);
                navigation.navigate('ChatConversation', {
                  sessionId: result.session.id,
                  partnerId: partnerId,
                  partnerName: matchedUser?.name || newMatch?.partnerName,
                });
              } else if (result?.chatRoomId) {
                const partnerId = result.user1Id === user?.id ? result.user2Id : result.user1Id;
                setIsInCall(false);
                navigation.navigate('ChatConversation', {
                  roomId: result.chatRoomId,
                  partnerId: partnerId,
                  partnerName: matchedUser?.name || newMatch?.partnerName,
                });
              } else {
                setIsInCall(false);
                navigation.navigate('Chats');
              }
            }
          },
          {
            text: 'Stay',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('[DiscoveryScreen] Error creating match:', error);
      setProcessingMatch(false);
      Alert.alert('Error', error?.message || 'Failed to create match. Please try again.');
    }
  };

  const refreshMatching = async () => {
    // Re-join queue with same preferences
    try {
      setShowNoUsersFound(false);
      setMatchingStartTime(Date.now());

      const preferences = {
        ageRange: {
          min: minAge,
          max: maxAge,
        },
        genderPreference: lookingFor === 'Any' ? null : lookingFor,
        maxDistance: distance,
        interests: selectedInterests.length > 0 ? selectedInterests : null,
        location: myLocation || null,
      };

      const status = await queueAPI.joinQueue(preferences);
      setQueueStatus(status);

      // Start polling for match and notifications
      startQueuePolling();
      startNotificationPolling();
    } catch (err) {
      console.error('Error refreshing match:', err);
      Alert.alert('Error', 'Failed to refresh matching. Please try again.');
    }
  };

  const startCallTimer = () => {
    if (callTimerStarted.current) {
      return;
    }

    callTimerStarted.current = true;
    callStartTime.current = Date.now();
    setCallDuration(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
      setCallDuration(elapsed);
    }, 1000);
  };

  const handleNextMatch = async () => {
    try {

      if (currentSession?.id) {
        try {
          await queueAPI.skipMatch(currentSession.id);
          // Backend will automatically re-queue both users
        } catch (skipError) {
          console.error('[DiscoveryScreen] Error skipping match:', skipError);
          // Continue even if skip fails
        }
      }
      
      // Restart matching for current user
      // User 2 will restart matching when they receive 'call-ended' event (handled in CallView)
      await startMatching();
    } catch (error) {
      console.error('[DiscoveryScreen] Error in handleNextMatch:', error);
      // Still try to restart matching even if there's an error
      try {
        await startMatching();
      } catch (retryError) {
        console.error('[DiscoveryScreen] Error restarting matching:', retryError);
      }
    }
  };

  const endCall = async () => {
    setIsInCall(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallDuration(0);
    callTimerStarted.current = false;

    // Clear matched user state
    setMatchedUser(null);
    setMatchedUserId(null);
    setMatchId(null);
    setNewMatch(null);
    clearPendingMatch();

    // End the session if there is one
    if (currentSession?.id) {
      try {
        await sessionAPI.endSession(currentSession.id);
      } catch (err) {
        console.error('Error ending session:', err);
      }
      setCurrentSession(null);
    }
  };

  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleInterest = (interestId) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const toggleLanguage = (languageName) => {
    setSelectedLanguages(prev =>
      prev.includes(languageName)
        ? prev.filter(lang => lang !== languageName)
        : [...prev, languageName]
    );
  };

  const adjustAge = (type, delta) => {
    if (type === 'min') {
      const newMin = Math.max(18, Math.min(maxAge - 1, minAge + delta));
      setMinAge(newMin);
    } else {
      const newMax = Math.min(100, Math.max(minAge + 1, maxAge + delta));
      setMaxAge(newMax);
    }
  };

  const getInterestsDisplay = () => {
    if (selectedInterests.length === 0) return 'None selected';
    const selectedNames = selectedInterests
      .slice(0, 3)
      .map(id => interests.find(i => i.id === id)?.name)
      .filter(Boolean)
      .join(' • ');
    return selectedInterests.length > 3
      ? `${selectedNames} +${selectedInterests.length - 3}`
      : selectedNames;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (queuePollingRef.current) {
        clearInterval(queuePollingRef.current);
      }
    };
  }, []);

  // Check if we should open filters from navigation params
  useEffect(() => {
    if (route?.params?.openFilters) {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowFilters(true);
        // Reset the param after opening filters
        navigation.setParams({ openFilters: false });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [route?.params?.openFilters]);

  // Auto-start matching when navigating from a call
  useEffect(() => {
    if (route?.params?.autoStartMatching) {
      console.log('[DiscoveryScreen] Auto-starting matching after call ended');
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        startMatching();
        // Reset the param after starting matching
        navigation.setParams({ autoStartMatching: false });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [route?.params?.autoStartMatching]);

  if (isInCall) {
    return (
      <CallView
        callDuration={callDuration}
        onEndCall={endCall}
        onNext={handleNextMatch}
        onSkipped={async () => {
          // When user is skipped by partner, re-queue and restart matching
          console.log('[DiscoveryScreen] User was skipped by partner, restarting matching...');
          await endCall();
          await startMatching();
        }}
        formatCallTime={formatCallTime}
        onCallStarted={startCallTimer}
        partnerProfile={matchedUser}
        currentUserId={user?.id}
        currentUserGender={user?.gender}
        partnerId={matchedUserId}
        sessionId={currentSession?.id}
        roomId={currentSession?.roomId}
      />
    );
  }

  // Match Notification Alert - appears at top of "Finding Your Match" screen
  // Match modal disabled for Omegle-style flow - users go directly to CallView
  const matchAlert = false && matchModalVisible && newMatch ? (
    <View style={styles.matchAlertContainer} pointerEvents="box-none">
      <View style={styles.matchAlertContent}>
        {/* Profile picture */}
        {newMatch?.partnerProfilePicture ? (
          <Image
            source={{ uri: newMatch.partnerProfilePicture }}
            style={styles.matchAlertProfilePicture}
          />
        ) : (
          <View style={[styles.matchAlertProfilePicture, styles.profilePlaceholder]}>
            <Ionicons name="person" size={32} color="#8E8E93" />
          </View>
        )}

        {/* Match info */}
        <View style={styles.matchAlertInfo}>
          <View style={styles.matchAlertTitleRow}>
            <Ionicons name="star" size={18} color="#ff4444" />
            <Text style={styles.matchAlertTitle}>New Match!</Text>
            {newMatch?.matchScore && (
              <Text style={styles.matchAlertScore}>
                {Math.round(newMatch.matchScore * 100)}%
              </Text>
            )}
          </View>
          <Text style={styles.matchAlertMessage} numberOfLines={1}>
            {newMatch?.partnerName || 'Someone'} wants to connect
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.matchAlertButtons}>
          <TouchableOpacity
            style={[styles.matchAlertButton, styles.declineAlertButton]}
            onPress={handleDeclineMatch}
            disabled={processingMatch}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {processingMatch ? (
              <ActivityIndicator size="small" color="#ff4444" />
            ) : (
              <Ionicons name="close" size={20} color="#ff4444" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.matchAlertButton, styles.acceptAlertButton]}
            onPress={handleAcceptMatch}
            disabled={processingMatch}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {processingMatch ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="checkmark" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Close button */}
        <TouchableOpacity
          style={styles.matchAlertCloseButton}
          onPress={() => {
            if (!processingMatch) {
              setMatchModalVisible(false);
            }
          }}
          disabled={processingMatch}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="#8E8E93" />
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  if (isFindingMatch) {
    return (
      <View style={{ flex: 1 }}>
        <MatchingView
          onFilterPress={() => setShowFilters(true)}
          onCancel={cancelMatching}
          onRefresh={refreshMatching}
          queuePosition={queueStatus?.position}
          estimatedWait={queueStatus?.estimatedWaitTime}
          showNoUsersFound={showNoUsersFound}
        />
        {/* Match modal disabled for Omegle-style flow - users go directly to CallView */}
        {false && matchModalVisible && newMatch ? (
          <Modal
            visible={matchModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              if (!processingMatch) {
                setMatchModalVisible(false);
              }
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.matchModalContent}>
                {/* Close button in top right */}
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    if (!processingMatch) {
                      setMatchModalVisible(false);
                    }
                  }}
                  disabled={processingMatch}
                >
                  <Ionicons name="close" size={24} color="#8E8E93" />
                </TouchableOpacity>

                {newMatch?.partnerProfilePicture ? (
                  <Image
                    source={{ uri: newMatch.partnerProfilePicture }}
                    style={styles.matchModalProfilePicture}
                  />
                ) : (
                  <View style={[styles.matchModalProfilePicture, styles.profilePlaceholder]}>
                    <Ionicons name="person" size={60} color="#8E8E93" />
                  </View>
                )}

                <Ionicons name="heart" size={40} color="#ff4444" style={styles.matchModalHeart} />
                <View style={styles.matchModalTitleContainer}>
                  <Ionicons name="star" size={24} color="#ff4444" style={styles.matchModalIcon} />
                  <Text style={styles.matchModalTitle}>New Match!</Text>
                </View>
                <Text style={styles.matchModalMessage}>
                  You have a new match with {newMatch?.partnerName || 'someone'}!
                </Text>

                {newMatch?.matchScore && (
                  <View style={styles.matchScoreContainer}>
                    <Text style={styles.matchScoreText}>
                      {Math.round(newMatch.matchScore * 100)}% Match
                    </Text>
                  </View>
                )}

                <View style={styles.matchModalButtons}>
                  <TouchableOpacity
                    style={[styles.matchModalButton, styles.declineButton]}
                    onPress={handleDeclineMatch}
                    disabled={processingMatch}
                  >
                    {processingMatch ? (
                      <ActivityIndicator size="small" color="#ff4444" />
                    ) : (
                      <>
                        <Ionicons name="close" size={20} color="#ff4444" />
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.matchModalButton, styles.acceptButton]}
                    onPress={handleAcceptMatch}
                    disabled={processingMatch}
                  >
                    {processingMatch ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={20} color="#ffffff" />
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    );
  }

  // const filterIcon = `
  //   <svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 100 100" viewBox="0 0 100 100">
  //     <path fill="#f1a300" d="M96.801,47.392L75.684,10.905c-0.905-1.556-2.571-2.613-4.51-2.613H28.849c-1.916,0-3.609,1.062-4.51,2.594
  //       c-2.233,3.855-7.573,13.08-9.738,16.819L3.199,47.397c-0.932,1.611-0.932,3.596,0,5.207l21.181,36.492
  //       c0.905,1.574,2.571,2.613,4.51,2.613h42.257c1.939,0,3.609-1.039,4.51-2.594l21.14-36.51
  //       C97.734,50.992,97.734,49.003,96.801,47.392z M38.403,26.885h23.236c6.888,0.211,6.898,10.217,0,10.432
  //       c-5.616,0-17.713,0-23.236,0C31.516,37.106,31.505,27.098,38.403,26.885z M56.501,73.245H43.541c-2.876,0-5.207-2.331-5.207-5.207
  //       c0-2.875,2.331-5.207,5.207-5.207c3.057,0,9.971,0,12.961,0C63.38,63.042,63.385,73.033,56.501,73.245z M71.083,55.28H28.936
  //       c-6.882-0.208-6.903-10.216,0-10.431c0,0,42.146,0,42.146,0C77.965,45.057,77.986,55.065,71.083,55.28z"/>
  //   </svg>
  // `;

  const filterButton = (
    <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
      <Image source={filterIcon} style={styles.filterIcon} />
    </TouchableOpacity>
  );

  const handleCallAccept = async () => {
    if (!incomingCallRequest?.callerId) {
      Alert.alert('Error', 'Caller information is missing.');
      return;
    }

    try {
      console.log('[DiscoveryScreen] Call accepted from:', incomingCallRequest.callerId);
      setCallNotificationVisible(false);

      // Emit call response (accept)
      if (incomingCallRequest?.callId) {
        emitCallResponse(incomingCallRequest.callId, 'accept');
      }

      // Create chat room and session automatically
      const callerId = incomingCallRequest.callerId;

      // Start session (this will create chat room automatically)
      try {
        const session = await sessionAPI.startSession(callerId, 'VIDEO');
        console.log('[DiscoveryScreen] Session created for call:', session);

        // Navigate to call view or start WebRTC call
        // The session creation ensures chat room exists in Chats tab
        Alert.alert('Call Accepted', 'Starting video call...');
      } catch (sessionError) {
        console.error('[DiscoveryScreen] Error creating session:', sessionError);
        // Still proceed with call even if session creation fails
        Alert.alert('Call Accepted', 'Starting video call...');
      }

      setIncomingCallRequest(null);
    } catch (error) {
      console.error('[DiscoveryScreen] Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call. Please try again.');
    }
  };

  const handleCallDecline = () => {
    console.log('[DiscoveryScreen] Call declined');
    if (incomingCallRequest?.callId) {
      emitCallResponse(incomingCallRequest.callId, 'decline');
    }
    setCallNotificationVisible(false);
    setIncomingCallRequest(null);
  };

  const handleCallIgnore = () => {
    console.log('[DiscoveryScreen] Call ignored');
    if (incomingCallRequest?.callId) {
      emitCallResponse(incomingCallRequest.callId, 'ignore');
    }
    setCallNotificationVisible(false);
    setIncomingCallRequest(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <CallNotification
        visible={callNotificationVisible}
        callerName={incomingCallRequest?.callerName || 'Someone'}
        callerProfilePicture={incomingCallRequest?.callerProfilePicture}
        onAccept={handleCallAccept}
        onDecline={handleCallDecline}
        onIgnore={handleCallIgnore}
        onDismiss={handleCallIgnore}
      />
      <ScreenHeader title="KYN" rightButton={filterButton} />

      <ScrollView style={styles.content}>
        <Text style={styles.headline}>Discover new connections!</Text>

        <View style={styles.parametersContainer}>
          <DiscoveryParameter
            icon="location"
            label="LOCATION"
            value={myLocation}
            detail={`${distance}km`}
          />
          <DiscoveryParameter
            icon="heart-outline"
            label="INTENT"
            value={intent}
          />
          <DiscoveryParameter
            icon="calendar"
            label="AGE RANGE"
            value={`${minAge}-${maxAge}`}
          />
          <DiscoveryParameter
            icon="pricetag"
            label="INTERESTS"
            value={getInterestsDisplay()}
          />
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startMatching}>
          <Ionicons name="play" size={20} color="#ffffff" />
          <Text style={styles.startButtonText}>Start Matching</Text>
        </TouchableOpacity>
      </ScrollView>

      <FiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        intent={intent}
        setIntent={setIntent}
        selectedInterests={selectedInterests}
        toggleInterest={toggleInterest}
        minAge={minAge}
        maxAge={maxAge}
        adjustAge={adjustAge}
        distance={distance}
        setDistance={setDistance}
        lookingFor={lookingFor}
        setLookingFor={setLookingFor}
        selectedLanguages={selectedLanguages}
        toggleLanguage={toggleLanguage}
        instantConnect={instantConnect}
        setInstantConnect={setInstantConnect}
        interests={interests}
        languages={languages}
        location={myLocation}
        setLocation={setMyLocation}
        isPremiumUser={isPremiumUser}
        navigation={navigation}
      />

      <VerificationBlockingModal
        visible={showVerificationModal}
        onNavigateToVerification={() => {
          setShowVerificationModal(false);
          navigation.navigate('EditProfile');
        }}
        onDismiss={() => setShowVerificationModal(false)}
      />

      {/* Match modal disabled for Omegle-style flow - users go directly to CallView */}
      {false && matchModalVisible && newMatch && !isFindingMatch ? (
        <Modal
          visible={matchModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (!processingMatch) {
              setMatchModalVisible(false);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.matchModalContent}>
              {/* Close button in top right */}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  if (!processingMatch) {
                    setMatchModalVisible(false);
                  }
                }}
                disabled={processingMatch}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>

              {newMatch?.partnerProfilePicture ? (
                <Image
                  source={{ uri: newMatch.partnerProfilePicture }}
                  style={styles.matchModalProfilePicture}
                />
              ) : (
                <View style={[styles.matchModalProfilePicture, styles.profilePlaceholder]}>
                  <Ionicons name="person" size={60} color="#8E8E93" />
                </View>
              )}

              <Ionicons name="heart" size={40} color="#ff4444" style={styles.matchModalHeart} />
              <View style={styles.matchModalTitleContainer}>
                <Ionicons name="star" size={24} color="#ff4444" style={styles.matchModalIcon} />
                <Text style={styles.matchModalTitle}>New Match!</Text>
              </View>
              <Text style={styles.matchModalMessage}>
                You have a new match with {newMatch?.partnerName || 'someone'}!
              </Text>

              {newMatch?.matchScore && (
                <View style={styles.matchScoreContainer}>
                  <Text style={styles.matchScoreText}>
                    {Math.round(newMatch.matchScore * 100)}% Match
                  </Text>
                </View>
              )}

              <View style={styles.matchModalButtons}>
                <TouchableOpacity
                  style={[styles.matchModalButton, styles.declineButton]}
                  onPress={handleDeclineMatch}
                  disabled={processingMatch}
                >
                  {processingMatch ? (
                    <ActivityIndicator size="small" color="#ff4444" />
                  ) : (
                    <>
                      <Ionicons name="close" size={20} color="#ff4444" />
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.matchModalButton, styles.acceptButton]}
                  onPress={handleAcceptMatch}
                  disabled={processingMatch}
                >
                  {processingMatch ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#ffffff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  filterButton: {
    padding: 8,
  },
  filterIcon: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headline: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 30,
    marginLeft: 19,
    textAlign: 'left',
  },
  parametersContainer: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    marginBottom: 40,
  },
  startButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  // Match Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  matchModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  matchModalProfilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  profilePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchModalHeart: {
    marginBottom: 10,
  },
  matchModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 8,
  },
  matchModalIcon: {
    marginRight: 4,
  },
  matchModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  matchModalMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  matchScoreContainer: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  matchScoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4444',
  },
  matchModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  matchModalButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 25,
    gap: 6,
  },
  declineButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4444',
  },
  acceptButton: {
    backgroundColor: '#000000',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Match Alert Styles (top banner on "Finding Your Match" screen)
  matchAlertContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  matchAlertContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  matchAlertProfilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  matchAlertInfo: {
    flex: 1,
    marginRight: 8,
  },
  matchAlertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  matchAlertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  matchAlertScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4444',
  },
  matchAlertMessage: {
    fontSize: 13,
    color: '#666666',
  },
  matchAlertButtons: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  matchAlertButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineAlertButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  acceptAlertButton: {
    backgroundColor: '#000000',
  },
  matchAlertCloseButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});