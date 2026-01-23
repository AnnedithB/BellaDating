import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useCallContext } from '../navigation/AppNavigator';
import {
  ScreenHeader,
  DiscoveryParameter,
  MatchingView,
  CallView,
} from '../components';
import FiltersModal from '../components/FiltersModal';
import filterIcon from '../../assets/filter.png';
import { queueAPI, sessionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function DiscoveryScreen({ navigation, route }) {
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [isFindingMatch, setIsFindingMatch] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [queueStatus, setQueueStatus] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const { isInCall, setIsInCall } = useCallContext();
  const callStartTime = useRef(null);
  const timerRef = useRef(null);
  const queuePollingRef = useRef(null);

  // Filter states
  const [intent, setIntent] = useState('Dating');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(45);
  const [distance, setDistance] = useState(50);
  const [lookingFor, setLookingFor] = useState('Any');
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);
  const [instantConnect, setInstantConnect] = useState(false);
  const [myLocation, setMyLocation] = useState('Ontario, California, United States');

  // Dummy location for other users (this is what we're discovering)
  const otherUserLocation = 'Los Angeles, CA, USA';

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
      setIsFindingMatch(true);

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

      // Join the queue
      const status = await queueAPI.joinQueue(preferences);
      setQueueStatus(status);

      // Start polling for match
      startQueuePolling();
    } catch (err) {
      console.error('Error starting match:', err);
      setIsFindingMatch(false);
      Alert.alert('Error', 'Failed to start matching. Please try again.');
    }
  };

  const startQueuePolling = () => {
    // Poll for queue status and match
    queuePollingRef.current = setInterval(async () => {
      try {
        const status = await queueAPI.getQueueStatus();
        setQueueStatus(status);

        // Check if we got matched (status would change or we'd have a session)
        if (status?.status === 'MATCHED') {
          stopQueuePolling();
          handleMatchFound();
        }
      } catch (err) {
        console.error('Error polling queue:', err);
      }
    }, 2000);
  };

  const stopQueuePolling = () => {
    if (queuePollingRef.current) {
      clearInterval(queuePollingRef.current);
      queuePollingRef.current = null;
    }
  };

  const handleMatchFound = async () => {
    // Get the new session
    try {
      const sessions = await sessionAPI.getActiveSessions();
      if (sessions && sessions.length > 0) {
        const latestSession = sessions[0];
        setCurrentSession(latestSession);
        setIsFindingMatch(false);
        setIsInCall(true);
        startCallTimer();
      }
    } catch (err) {
      console.error('Error getting session after match:', err);
    }
  };

  const cancelMatching = async () => {
    try {
      stopQueuePolling();
      await queueAPI.leaveQueue();
      setIsFindingMatch(false);
      setQueueStatus(null);
    } catch (err) {
      console.error('Error canceling match:', err);
      setIsFindingMatch(false);
    }
  };

  const startCallTimer = () => {
    callStartTime.current = Date.now();
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
      setCallDuration(elapsed);
    }, 1000);
  };

  const endCall = async () => {
    setIsInCall(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallDuration(0);

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

  if (isInCall) {
    return (
      <CallView
        callDuration={callDuration}
        onEndCall={endCall}
        formatCallTime={formatCallTime}
      />
    );
  }

  if (isFindingMatch) {
    return (
      <MatchingView
        onFilterPress={() => setShowFilters(true)}
        onCancel={cancelMatching}
        queuePosition={queueStatus?.position}
        estimatedWait={queueStatus?.estimatedWaitTime}
      />
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
    <Image source={filterIcon} style={styles.filterIcon} height={35} width={35}/> 
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="KYN" rightButton={filterButton}  />

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
        navigation={navigation}
      />
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
});