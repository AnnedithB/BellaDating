import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DynamicIcon from './DynamicIcon';
import { colors } from '../styles/colors';

const ScreenHeader = ({ title, rightButton, showBack = false }) => {
  const navigation = useNavigation();
  const isMainTab = ['Discovery', 'Chats', 'Activity', 'Profile'].includes(title);

  return (
    <View style={[
        styles.header,
        showBack && styles.headerWithBack,
        rightButton && styles.headerWithRightButton
      ]}>
      <View style={[styles.leftContainer, !rightButton && { flex: 1 }]}>
        {showBack && !isMainTab && (
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <DynamicIcon
              iconName="arrow-back"
              iconFamily="MaterialIcons"
              iconColor={colors.black}
              iconSize={26}
            />
          </TouchableOpacity>
        )}
        {!rightButton ? (
          <View style={styles.centerContainer}>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        ) : (
          <Text style={[styles.headerTitle, { marginLeft: 20 }]}>{title}</Text>
        )}
      </View>
      {rightButton && (
        <View style={styles.rightContainer}>
          {rightButton}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  leftContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backButton: {
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
});

export default ScreenHeader;
