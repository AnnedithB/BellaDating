import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components';
import { Ionicons } from '@expo/vector-icons'; // Used for icons

// --- MOCK DATA ---
// In a real app, you would fetch this from the
// admin-service/src/routes/knowledge-base.ts endpoint
const MOCK_CATEGORIES = [
  {
    id: '1',
    title: 'Account & Profile',
    icon: 'person-circle-outline',
  },
  {
    id: '2',
    title: 'Billing & Subscriptions',
    icon: 'card-outline',
  },
  {
    id: '3',
    title: 'Safety & Reporting',
    icon: 'shield-half-outline',
  },
  {
    id: '4',
    title: 'App Features & How-To',
    icon: 'book-outline',
  },
];
// -----------------

const ACCENT_COLOR = '#000000'; // Black
const LIGHT_GRAY = '#E5E7EB';
const MEDIUM_GRAY = '#6B7280';
const BACKGROUND_GRAY = '#f3f4f6';
const DIVIDER_COLOR = '#f3f4f6';

export default function HelpSupportScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');

  // --- Handlers for Navigation ---
  const handleSearch = (query) => {
    if (!query) return;
    console.log('Search for:', query);
    // navigation.navigate('ArticleList', { searchQuery: query });
    Alert.alert('Search', `This will search for "${query}".`);
  };

  const handleCategoryPress = (category) => {
    console.log('Navigate to category:', category.title);
    // navigation.navigate('ArticleList', { categoryId: category.id });
    Alert.alert(
      'Navigate',
      `This will open the "${category.title}" article list.`
    );
  };

  const handleMyTickets = () => {
    console.log('Navigate to My Support Tickets');
    // navigation.navigate('MyTickets');
    Alert.alert('Navigate', 'This will open the "My Support Tickets" screen.');
  };

  const handleSubmitTicket = () => {
    console.log('Navigate to Submit New Ticket');
    // navigation.navigate('NewTicket');
    Alert.alert('Navigate', 'This will open the "Submit New Ticket" screen.');
  };

  /**
   * Renders a navigation row for a knowledge base category.
   */
  const renderCategoryOption = (category) => (
    <TouchableOpacity
      key={category.id}
      style={styles.navRow}
      onPress={() => handleCategoryPress(category)}>
      <Ionicons
        name={category.icon}
        size={24}
        color={ACCENT_COLOR}
        style={styles.leftIcon}
      />
      <Text style={styles.navRowText}>{category.title}</Text>
      <Ionicons
        name="chevron-forward-outline"
        size={20}
        color={MEDIUM_GRAY}
      />
    </TouchableOpacity>
  );

  /**
   * Renders a navigation row for contacting support.
   */
  const renderSupportOption = ({ title, onPress, iconName }) => (
    <TouchableOpacity style={styles.navRow} onPress={onPress}>
      <Ionicons
        name={iconName}
        size={24}
        color={ACCENT_COLOR}
        style={styles.leftIcon}
      />
      <Text style={styles.navRowText}>{title}</Text>
      <Ionicons
        name="chevron-forward-outline"
        size={20}
        color={MEDIUM_GRAY}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* --- Header --- */}
      <ScreenHeader title="Help & Support" navigation={navigation} showBack={true}/>

      {/* --- Scrollable Content --- */}
      <ScrollView
        style={styles.scrollContainer}
        keyboardShouldPersistTaps="handled">
        <View style={styles.contentContainer}>
          <Text style={styles.welcomeTitle}>How can we help?</Text>

          {/* --- Search Bar --- */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color={MEDIUM_GRAY}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search help articles..."
              placeholderTextColor={MEDIUM_GRAY}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch(searchQuery)}
              returnKeyType="search"
            />
          </View>

          {/* --- Knowledge Base Section --- */}
          <Text style={styles.sectionTitle}>Find Answers</Text>
          <View style={styles.navContainer}>
            {MOCK_CATEGORIES.map(renderCategoryOption)}
          </View>

          <View style={styles.divider} />

          {/* --- Support Ticket Section --- */}
          <Text style={styles.sectionTitle}>Need More Help?</Text>
          <View style={styles.navContainer}>
            {renderSupportOption({
              title: 'My Support Tickets',
              onPress: handleMyTickets,
              iconName: 'ticket-outline',
            })}
            {renderSupportOption({
              title: 'Contact Us',
              onPress: handleSubmitTicket,
              iconName: 'pencil-outline',
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BACKGROUND_GRAY,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#000000',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: MEDIUM_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  navContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DIVIDER_COLOR,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER_COLOR,
  },
  leftIcon: {
    marginRight: 16,
  },
  navRowText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: 'transparent', // just for spacing
    marginVertical: 16,
  },
});
