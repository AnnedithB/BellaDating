import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supportAPI } from '../services/api';

const getStatusColor = (status) => {
  switch (status) {
    case 'OPEN':
      return '#FF3B30';
    case 'IN_PROGRESS':
      return '#007AFF';
    case 'WAITING_FOR_CUSTOMER':
      return '#FF9500';
    case 'RESOLVED':
      return '#34C759';
    case 'CLOSED':
      return '#8E8E93';
    default:
      return '#8E8E93';
  }
};

const getStatusLabel = (status) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function MyTicketsScreen({ navigation, route }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  // Refresh tickets when screen comes into focus (e.g., after submitting a new ticket)
  useFocusEffect(
    useCallback(() => {
      // Check if we need to refresh from route params
      const refresh = route?.params?.refresh;
      const newTicketNumber = route?.params?.newTicketNumber;
      
      if (refresh) {
        loadTickets().then(() => {
          // After tickets are loaded, navigate to the new ticket detail if specified
          if (newTicketNumber) {
            // Small delay to ensure tickets list is rendered
            setTimeout(() => {
              navigation.navigate('TicketDetail', { ticketNumber: newTicketNumber });
              // Clear the params to prevent re-navigation
              navigation.setParams({ refresh: undefined, newTicketNumber: undefined });
            }, 300);
          }
        });
      }
    }, [route?.params, navigation])
  );

  const loadTickets = async () => {
    try {
      setLoading(true);
      const userEmail = user?.email || user?.profile?.email || '';
      
      if (!userEmail) {
        setTickets([]);
        return;
      }
      
      const response = await supportAPI.getMyTickets(userEmail);
      
      if (response?.status === 'success' && response?.data) {
        setTickets(Array.isArray(response.data) ? response.data : []);
      } else if (response?.data) {
        // Handle case where data is directly in response
        setTickets(Array.isArray(response.data) ? response.data : []);
      } else {
        setTickets([]);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      // If error is due to endpoint not existing, show empty state
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTickets();
  };

  const handleViewTicket = (ticket) => {
    // Navigate to ticket detail screen (to be implemented)
    navigation.navigate('TicketDetail', { ticketNumber: ticket.ticketNumber });
  };

  const handleAddTicket = () => {
    navigation.navigate('SubmitTicket');
  };

  const rightButton = (
    <TouchableOpacity
      onPress={handleAddTicket}
      style={styles.addButton}
    >
      <Ionicons name="add" size={28} color="#000000" />
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader 
          title="My Support Tickets" 
          navigation={navigation} 
          showBack={true}
          rightButton={rightButton}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="My Support Tickets" 
        navigation={navigation} 
        showBack={true}
        rightButton={rightButton}
      />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {tickets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Tickets Yet</Text>
            <Text style={styles.emptyText}>
              You haven't submitted any support tickets yet. Submit a ticket to get help with any issues.
            </Text>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => navigation.navigate('SubmitTicket')}
            >
              <Text style={styles.submitButtonText}>Submit a Ticket</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ticketsList}>
            {tickets.map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                style={styles.ticketCard}
                onPress={() => handleViewTicket(ticket)}
              >
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(ticket.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{getStatusLabel(ticket.status)}</Text>
                  </View>
                </View>
                <Text style={styles.ticketSubject}>{ticket.subject || ticket.title || 'No Subject'}</Text>
                <Text style={styles.ticketCategory}>
                  {ticket.category ? ticket.category.replace(/_/g, ' ') : 'General'}
                </Text>
                <Text style={styles.ticketDate}>
                  {ticket.createdAt 
                    ? new Date(ticket.createdAt).toLocaleDateString() 
                    : 'Date not available'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" style={styles.chevron} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ticketsList: {
    padding: 20,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  ticketCategory: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  ticketDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
});
