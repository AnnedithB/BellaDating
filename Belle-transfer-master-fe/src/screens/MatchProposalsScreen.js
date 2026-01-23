import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { matchAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MatchProposalsScreen({ navigation, route }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingMatch, setProcessingMatch] = useState(null);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const pendingMatches = await matchAPI.getPendingMatches();
      setMatches(pendingMatches || []);
    } catch (error) {
      console.error('Error loading matches:', error);
      Alert.alert('Error', 'Failed to load match proposals. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  const handleAccept = async (match) => {
    try {
      setProcessingMatch(match.id);
      const result = await matchAPI.acceptMatch(match.id);
      
      Alert.alert(
        'Match Accepted! 🎉',
        `You are now connected with ${getPartnerName(match)}!`,
        [
          {
            text: 'Start Chatting',
            onPress: () => {
              // Navigate to chat if session was created
              if (result.session) {
                navigation.navigate('ChatConversation', {
                  sessionId: result.session.id,
                  partnerId: getPartnerId(match),
                  partnerName: getPartnerName(match),
                });
              } else {
                // Just go back and refresh
                loadMatches();
                navigation.goBack();
              }
            },
          },
        ]
      );
      
      // Remove accepted match from list
      setMatches(matches.filter(m => m.id !== match.id));
    } catch (error) {
      console.error('Error accepting match:', error);
      Alert.alert('Error', 'Failed to accept match. Please try again.');
    } finally {
      setProcessingMatch(null);
    }
  };

  const handleDecline = async (match) => {
    Alert.alert(
      'Decline Match',
      `Are you sure you want to decline the match with ${getPartnerName(match)}?`,
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
              setProcessingMatch(match.id);
              await matchAPI.declineMatch(match.id);
              
              // Remove declined match from list
              setMatches(matches.filter(m => m.id !== match.id));
              
              Alert.alert('Match Declined', 'The match has been declined.');
            } catch (error) {
              console.error('Error declining match:', error);
              Alert.alert('Error', 'Failed to decline match. Please try again.');
            } finally {
              setProcessingMatch(null);
            }
          },
        },
      ]
    );
  };

  const getPartnerId = (match) => {
    return match.user1Id === user?.id ? match.user2Id : match.user1Id;
  };

  const getPartner = (match) => {
    return match.user1Id === user?.id ? match.user2 : match.user1;
  };

  const getPartnerName = (match) => {
    const partner = getPartner(match);
    return partner?.name || 'Someone';
  };

  const formatMatchScore = (score) => {
    return Math.round(score * 100);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match Proposals</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  if (matches.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match Proposals</Text>
          <View style={styles.placeholder} />
        </View>
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons name="heart-outline" size={80} color="#cccccc" />
          <Text style={styles.emptyText}>No pending matches</Text>
          <Text style={styles.emptySubtext}>
            When you get matched with someone, they'll appear here
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Proposals</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {matches.map((match) => {
          const partner = getPartner(match);
          const isProcessing = processingMatch === match.id;

          return (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <View style={styles.profileImageContainer}>
                  {partner?.profilePicture ? (
                    <Image
                      source={{ uri: partner.profilePicture }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Ionicons name="person" size={40} color="#cccccc" />
                    </View>
                  )}
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchName}>
                    {getPartnerName(match)}
                    {partner?.age && `, ${partner.age}`}
                  </Text>
                  {partner?.location && (
                    <Text style={styles.matchLocation}>{partner.location}</Text>
                  )}
                  <View style={styles.matchScoreContainer}>
                    <Ionicons name="heart" size={16} color="#ff4444" />
                    <Text style={styles.matchScore}>
                      {formatMatchScore(match.totalScore)}% Match
                    </Text>
                  </View>
                </View>
              </View>

              {partner?.bio && (
                <Text style={styles.matchBio} numberOfLines={2}>
                  {partner.bio}
                </Text>
              )}

              {partner?.interests && partner.interests.length > 0 && (
                <View style={styles.interestsContainer}>
                  {partner.interests.slice(0, 3).map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.declineButton]}
                  onPress={() => handleDecline(match)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#ff4444" />
                  ) : (
                    <>
                      <Ionicons name="close" size={20} color="#ff4444" />
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.acceptButton]}
                  onPress={() => handleAccept(match)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
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
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  scrollView: {
    flex: 1,
  },
  matchCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  matchHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  profileImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  matchName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  matchLocation: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  matchScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4444',
    marginLeft: 4,
  },
  matchBio: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  interestTag: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  interestText: {
    fontSize: 12,
    color: '#666666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
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
});








