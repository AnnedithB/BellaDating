import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DiscoveryScreen from '../screens/DiscoveryScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useCallContext } from './AppNavigator';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { isInCall } = useCallContext();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Discovery') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Chats') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Activity') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: isInCall ? { 
          display: 'none' 
        } : {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E5E5E7',
          paddingBottom: Math.max(insets.bottom - 24, 6),
          paddingTop: 10,
          height: 84 + Math.max(insets.bottom - 24, 6),
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Discovery" component={DiscoveryScreen} leftButton={false} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
