import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import LocationModal from './LocationModal';

export default function FiltersModal({
  visible,
  onClose,
  intent,
  setIntent,
  selectedInterests,
  toggleInterest,
  minAge,
  maxAge,
  adjustAge,
  distance,
  setDistance,
  lookingFor,
  setLookingFor,
  selectedLanguages,
  toggleLanguage,
  instantConnect,
  setInstantConnect,
  interests,
  languages,
  location,
  setLocation,
}) {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const { width, height } = useWindowDimensions();
  const isSmallDevice = width < 375;

  const handleLocationSelect = (newLocation) => {
    setLocation(newLocation);
    setShowLocationModal(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filters & Preferences</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.filterSection, {marginTop: '5%'}]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>Intent</Text>
            </View>
            <View style={styles.segmentedControl}>
              {['Dating', 'Friends', 'Networking'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.segmentButton,
                    intent === option && styles.segmentButtonActive
                  ]}
                  onPress={() => setIntent(option)}
                >
                  <Text style={[
                    styles.segmentButtonText,
                    intent === option && styles.segmentButtonTextActive
                  ]}>
                    {option}
                  </Text>
                  {intent === option && (
                    <Ionicons name="checkmark" size={16} color="#ffffff" style={styles.checkmark} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
            <TouchableOpacity 
              style={styles.locationButton}
              onPress={() => setShowLocationModal(true)}
            >
              <Ionicons name="navigate" size={20} color="#666666" style={styles.locationIcon} />
              <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
              <Ionicons name="chevron-forward" size={20} color="#cccccc" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>
                Interests ({selectedInterests.length} selected)
              </Text>
            </View>
            <View style={styles.interestsGrid}>
              {interests.map((interest) => (
                <TouchableOpacity
                  key={interest.id}
                  style={[
                    styles.interestButton,
                    selectedInterests.includes(interest.id) && styles.interestButtonSelected
                  ]}
                  onPress={() => toggleInterest(interest.id)}
                >
                  <Ionicons 
                    name={interest.icon} 
                    size={16} 
                    color={selectedInterests.includes(interest.id) ? '#ffffff' : '#8E8E93'} 
                  />
                  <Text style={[
                    styles.interestText,
                    selectedInterests.includes(interest.id) && styles.interestTextSelected
                  ]}>
                    {interest.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>Age Range: {minAge}-{maxAge}</Text>
            </View>
            <View style={styles.ageControls}>
              <View style={styles.ageControl}>
                <Text style={styles.ageLabel}>Min</Text>
                <View style={styles.ageButtons}>
                  <TouchableOpacity
                    style={styles.ageButton}
                    onPress={() => adjustAge('min', -1)}
                  >
                    <Text style={styles.ageButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.ageValue}>{minAge}</Text>
                  <TouchableOpacity
                    style={styles.ageButton}
                    onPress={() => adjustAge('min', 1)}
                  >
                    <Text style={styles.ageButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.ageControl}>
                <Text style={styles.ageLabel}>Max</Text>
                <View style={styles.ageButtons}>
                  <TouchableOpacity
                    style={styles.ageButton}
                    onPress={() => adjustAge('max', -1)}
                  >
                    <Text style={styles.ageButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.ageValue}>{maxAge}</Text>
                  <TouchableOpacity
                    style={styles.ageButton}
                    onPress={() => adjustAge('max', 1)}
                  >
                    <Text style={styles.ageButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          

          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="compass" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>Distance: {Math.round(distance)}km</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>1km</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={100}
                value={distance}
                onValueChange={setDistance}
                minimumTrackTintColor="#000000"
                maximumTrackTintColor="#E5E5E7"
                thumbStyle={styles.sliderThumb}
              />
              <Text style={styles.sliderLabel}>100km</Text>
            </View>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>Looking For</Text>
            </View>
            <View style={styles.segmentedControl}>
              {['Any', 'Male', 'Female'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.segmentButton,
                    lookingFor === option && styles.segmentButtonActive
                  ]}
                  onPress={() => setLookingFor(option)}
                >
                  <Text style={[
                    styles.segmentButtonText,
                    lookingFor === option && styles.segmentButtonTextActive
                  ]}>
                    {option}
                  </Text>
                  {lookingFor === option && (
                    <Ionicons name="checkmark" size={16} color="#ffffff" style={styles.checkmark} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="globe" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>
                Languages ({selectedLanguages.length} selected)
              </Text>
            </View>
            <View style={styles.languagesGrid}>
              {languages.map((language) => (
                <TouchableOpacity
                  key={language.id}
                  style={[
                    styles.languageChip,
                    selectedLanguages.includes(language.name) && styles.languageChipSelected
                  ]}
                  onPress={() => toggleLanguage(language.name)}
                >
                  <Ionicons 
                    name="flag" 
                    size={16} 
                    color={selectedLanguages.includes(language.name) ? '#ffffff' : '#8E8E93'} 
                  />
                  <Text style={[
                    styles.languageChipText,
                    selectedLanguages.includes(language.name) && styles.languageChipTextSelected
                  ]}>
                    {language.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* <View style={styles.filterSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash" size={20} color="#000000" />
              <Text style={styles.sectionTitle}>Instant Connect</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.instantConnectChip,
                instantConnect && styles.instantConnectChipSelected
              ]}
              onPress={() => setInstantConnect(!instantConnect)}
            >
              <Ionicons 
                name="flash" 
                size={16} 
                color={instantConnect ? '#ffffff' : '#8E8E93'} 
              />
              <Text style={[
                styles.instantConnectChipText,
                instantConnect && styles.instantConnectChipTextSelected
              ]}>
                {instantConnect ? 'Enabled' : 'Disabled'}
              </Text>
              <Ionicons 
                name={instantConnect ? "checkmark" : "close"} 
                size={16} 
                color={instantConnect ? "#ffffff" : "#FF3B30"} 
              />
            </TouchableOpacity>
            <Text style={styles.instantConnectDescription}>
              Start calls immediately without queue
            </Text>
          </View> */}
        </ScrollView>
        
        <LocationModal
          visible={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onLocationSelect={handleLocationSelect}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 8,
  },
  locationIcon: {
    marginRight: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#000000',
  },
  segmentButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  segmentButtonTextActive: {
    color: '#ffffff',
  },
  checkmark: {
    marginLeft: 4,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  interestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  interestButtonSelected: {
    backgroundColor: '#000000',
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  interestTextSelected: {
    color: '#ffffff',
  },
  ageControls: {
    flexDirection: 'row',
    gap: 24,
  },
  ageControl: {
    flex: 1,
  },
  ageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  ageButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  ageButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    minWidth: 30,
    textAlign: 'center',
  },
  ageButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderThumb: {
    backgroundColor: '#000000',
    width: 20,
    height: 20,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    minWidth: 40,
    textAlign: 'center',
  },
  languagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  languageChipSelected: {
    backgroundColor: '#000000',
  },
  languageChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  languageChipTextSelected: {
    color: '#ffffff',
  },
  instantConnectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  instantConnectChipSelected: {
    backgroundColor: '#000000',
  },
  instantConnectChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  instantConnectChipTextSelected: {
    color: '#ffffff',
  },
  instantConnectDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
});