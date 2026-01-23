import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Animated } from 'react-native';

import DiscoveryScreen from '../screens/DiscoveryScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useCallContext } from './AppNavigator';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { isInCall } = useCallContext();

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
          paddingBottom: 20,
          paddingTop: 12,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
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
