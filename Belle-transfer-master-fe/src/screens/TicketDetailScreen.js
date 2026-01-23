import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'URGENT':
      return '#FF3B30';
    case 'HIGH':
      return '#FF9500';
    case 'MEDIUM':
      return '#007AFF';
    case 'LOW':
      return '#34C759';
    default:
      return '#8E8E93';
  }
};

export default function TicketDetailScreen({ route, navigation }) {
  const { ticketNumber } = route.params || {};
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    if (ticketNumber) {
      loadTicket(true); // Show loading on initial load
    }
  }, [ticketNumber]);

  const loadTicket = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await supportAPI.getTicketStatus(ticketNumber);
      
      if (response?.status === 'success' && response?.data) {
        setTicket(response.data);
      } else {
        if (showLoading) {
          Alert.alert('Error', 'Failed to load ticket details');
          navigation.goBack();
        }
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
      if (showLoading) {
        Alert.alert('Error', error.message || 'Failed to load ticket details');
        navigation.goBack();
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTicket();
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim() || responseText.trim().length < 5) {
      Alert.alert('Error', 'Response must be at least 5 characters long');
      return;
    }

    try {
      setSubmittingResponse(true);
      const userEmail = user?.email || user?.profile?.email || '';
      
      if (!userEmail) {
        Alert.alert('Error', 'Unable to identify your email address');
        return;
      }

      await supportAPI.respondToTicket(ticketNumber, {
        content: responseText.trim(),
        customerEmail: userEmail,
        attachments: [],
      });

      // Close modal and clear form immediately
      setShowResponseModal(false);
      setResponseText('');
      
      // Reload ticket to show the new response (without showing loading spinner)
      setRefreshing(true);
      await loadTicket();
      
      // Show success message after reload
      Alert.alert(
        'Success',
        'Your response has been submitted successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting response:', error);
      Alert.alert('Error', error.message || 'Failed to submit response. Please try again.');
    } finally {
      setSubmittingResponse(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Ticket Details" navigation={navigation} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Ticket Details" navigation={navigation} showBack={true} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Ticket not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Ticket Details" navigation={navigation} showBack={true} />
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
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

          <Text style={styles.subject}>{ticket.subject}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="folder-outline" size={16} color="#6B7280" />
              <Text style={styles.metaText}>
                {ticket.category ? ticket.category.replace(/_/g, ' ') : 'General'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="flag-outline" size={16} color={getPriorityColor(ticket.priority)} />
              <Text style={[styles.metaText, { color: getPriorityColor(ticket.priority) }]}>
                {ticket.priority || 'Medium'}
              </Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Created</Text>
              <Text style={styles.dateValue}>
                {ticket.createdAt
                  ? new Date(ticket.createdAt).toLocaleString()
                  : 'Date not available'}
              </Text>
            </View>
            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Last Updated</Text>
                <Text style={styles.dateValue}>
                  {new Date(ticket.updatedAt).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{ticket.description || 'No description provided'}</Text>
        </View>

        {ticket.comments && ticket.comments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Conversation</Text>
            {ticket.comments.map((comment, index) => (
              <View key={comment.id || index} style={styles.comment}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>
                    {comment.isFromCustomer ? 'You' : 'Support Team'}
                  </Text>
                  <Text style={styles.commentDate}>
                    {comment.createdAt
                      ? new Date(comment.createdAt).toLocaleString()
                      : ''}
                  </Text>
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
            ))}
          </View>
        )}

        {ticket.attachments && ticket.attachments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Attachments</Text>
            {ticket.attachments.map((attachment, index) => (
              <View key={attachment.id || index} style={styles.attachment}>
                <Ionicons name="document-outline" size={20} color="#007AFF" />
                <Text style={styles.attachmentName}>
                  {attachment.originalName || attachment.filename || `Attachment ${index + 1}`}
                </Text>
                {attachment.fileSize && (
                  <Text style={styles.attachmentSize}>
                    {(attachment.fileSize / 1024).toFixed(2)} KB
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
          <TouchableOpacity
            style={styles.respondButton}
            onPress={() => setShowResponseModal(true)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
            <Text style={styles.respondButtonText}>Add Response</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowResponseModal(false);
          setResponseText('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Response</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowResponseModal(false);
                  setResponseText('');
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Your Response *</Text>
            <TextInput
              style={styles.responseInput}
              placeholder="Type your response here..."
              placeholderTextColor="#9CA3AF"
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{responseText.length}/2000 characters</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowResponseModal(false);
                  setResponseText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.submitButton,
                  (submittingResponse || !responseText.trim() || responseText.trim().length < 5) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitResponse}
                disabled={submittingResponse || !responseText.trim() || responseText.trim().length < 5}
              >
                {submittingResponse ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  subject: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  comment: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  commentDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  commentContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
  },
  attachmentSize: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  respondButton: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    gap: 8,
  },
  respondButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    minHeight: 150,
    maxHeight: 200,
    backgroundColor: '#FFFFFF',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#000000',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
