import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LocationModal({ visible, onClose, onLocationSelect }) {
  const { width, height } = useWindowDimensions();
  const isSmallDevice = width < 375;
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce function to avoid too many API calls
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchLocations();
      } else {
        setSuggestions([]);
        setIsLoading(false);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const searchLocations = async () => {
    setIsLoading(true);
    
    try {
      // Using Nominatim API for autocomplete
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(searchQuery)}` +
        `&format=json` +
        `&addressdetails=1` +
        `&limit=10`,
        {
          headers: {
            'User-Agent': 'LocationSearchApp/1.0',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      
      // Format the suggestions
      const formattedSuggestions = data.map(location => ({
        id: location.place_id.toString(),
        name: location.display_name,
        lat: location.lat,
        lon: location.lon,
        type: location.type,
      }));
      
      setSuggestions(formattedSuggestions);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (locationName) => {
    onLocationSelect(locationName);
    setSearchQuery('');
    setSuggestions([]);
  };

  const getLocationIcon = (type) => {
    switch (type) {
      case 'city':
      case 'town':
      case 'village':
        return 'business';
      case 'state':
      case 'country':
        return 'globe';
      case 'suburb':
      case 'neighbourhood':
        return 'home';
      default:
        return 'location';
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Change Location</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a city, state, or country"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.length >= 2) {
                  setIsLoading(true);
                }
              }}
              autoFocus={true}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999999" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#000000" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            )}

            {!isLoading && searchQuery.length > 0 && suggestions.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={48} color="#cccccc" />
                <Text style={styles.emptyText}>No locations found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            )}

            {!isLoading && suggestions.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Suggestions</Text>
                {suggestions.map((location) => (
                  <TouchableOpacity
                    key={location.id}
                    style={styles.locationItem}
                    onPress={() => handleLocationSelect(location.name)}
                  >
                    <View style={styles.locationIconContainer}>
                      <Ionicons 
                        name={getLocationIcon(location.type)} 
                        size={20} 
                        color="#666666" 
                      />
                    </View>
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationName} numberOfLines={2}>
                        {location.name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#cccccc" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchQuery.length === 0 && (
              <View>
                <Text style={styles.sectionTitle}>Search for a location</Text>
                <Text style={styles.hintText}>
                  Start typing to see suggestions
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    height: '85%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    backgroundColor: '#f8f8f8',
    minHeight: 50,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
  },
  clearButton: {
    padding: 4,
  },
  resultsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  locationName: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#666666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
  },
  hintText: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 20,
  },
});