import React from 'react';
import { StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import Entypo from 'react-native-vector-icons/Entypo';
import AntDesign from 'react-native-vector-icons/AntDesign';

const iconSets = {
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome,
  FontAwesome5,
  Ionicons,
  Feather,
  Entypo,
  AntDesign,
};

const DynamicIcon = ({
  iconName,
  iconFamily = 'MaterialIcons',
  iconSize = 24,
  iconColor = '#000',
  style,
  onPress,
}) => {
  const IconComponent = iconSets[iconFamily] || MaterialIcons;

  if (onPress) {
    return (
      <IconComponent
        name={iconName}
        size={iconSize}
        color={iconColor}
        style={[styles.icon, style]}
        onPress={onPress}
      />
    );
  }

  return (
    <IconComponent
      name={iconName}
      size={iconSize}
      color={iconColor}
      style={[styles.icon, style]}
    />
  );
};

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
});

export default DynamicIcon;
