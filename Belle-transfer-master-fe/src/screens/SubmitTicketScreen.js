import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supportAPI } from '../services/api';

const TICKET_CATEGORIES = [
  { value: 'GENERAL', label: 'General Inquiry' },
  { value: 'TECHNICAL', label: 'Technical Issue' },
  { value: 'BILLING', label: 'Billing & Payments' },
  { value: 'ACCOUNT', label: 'Account Issues' },
  { value: 'CONTENT', label: 'Content & Matching' },
  { value: 'SAFETY', label: 'Safety & Security' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function SubmitTicketScreen({ navigation }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState(TICKET_CATEGORIES);

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('GENERAL');
    setPriority('MEDIUM');
    setLoading(false);
  };

  // Reset form when screen comes into focus if form appears to be from a previous submission
  // (i.e., if title and description are both empty, it's likely a fresh start)
  useFocusEffect(
    React.useCallback(() => {
      // Don't auto-reset if user has started typing
      // Only reset if we're coming back and form is in a "submitted" state
      // We'll rely on manual reset after successful submission
      return () => {
        // Cleanup on blur
      };
    }, [])
  );

  const loadCategories = async () => {
    try {
      const response = await supportAPI.getCategories();
      if (response?.data) {
        setCategories(
          response.data.map((cat) => ({
            value: cat.value,
            label: cat.label,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Use default categories
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const userEmail = user?.email || user?.profile?.email || '';
      const userName = user?.name || user?.profile?.displayName || userEmail.split('@')[0] || 'User';

      const response = await supportAPI.submitTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        userEmail,
        userName,
      });

      if (response?.status === 'success') {
        const ticketData = response.data || {};
        const ticketNumber = ticketData.ticketNumber || ticketData.ticket?.ticketNumber || 'N/A';
        const ticketId = ticketData.id || ticketData.ticket?.id;
        
        // Reset form immediately after successful submission
        resetForm();
        
        // Navigate to MyTickets with refresh flag and new ticket number
        // MyTickets will refresh and then navigate to the ticket detail
        navigation.navigate('MyTickets', { 
          refresh: true, 
          newTicketNumber: ticketNumber 
        });
      } else {
        throw new Error(response?.message || 'Failed to submit ticket');
      }
    } catch (error) {
      console.error('Error submitting ticket:', error);
      let errorMessage = 'Failed to submit support ticket. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Submit Support Ticket" navigation={navigation} showBack={true} />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.label}>Category *</Text>
        <View style={styles.categoryContainer}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[styles.categoryButton, category === cat.value && styles.categoryButtonActive]}
              onPress={() => setCategory(cat.value)}
            >
              <Text style={[styles.categoryText, category === cat.value && styles.categoryTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityContainer}>
          {PRIORITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.priorityButton, priority === opt.value && styles.priorityButtonActive]}
              onPress={() => setPriority(opt.value)}
            >
              <Text style={[styles.priorityText, priority === opt.value && styles.priorityTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Subject *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter a brief subject for your ticket"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your issue in detail"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={8}
          maxLength={2000}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/2000 characters</Text>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#ffffff" style={styles.submitIcon} />
              <Text style={styles.submitButtonText}>Submit Ticket</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    marginTop: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  categoryText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  priorityButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  priorityButtonActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  priorityText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  priorityTextActive: {
    color: '#ffffff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  textArea: {
    height: 150,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
