import React from 'react';
import { View, Text, StyleSheet, Image, FlatList } from 'react-native';

const mediaData = [
  { id: '1', type: 'photo', source: { uri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' } },
  { id: '2', type: 'photo', source: { uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' } },
  { id: '3', type: 'photo', source: { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' } },
  { id: '4', type: 'photo', source: { uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' } },
  { id: '5', type: 'photo', source: { uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHBvcnRyYWl0fGVufDB8fDB8fHww' } },
  { id: '6', type: 'photo', source: { uri: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4b793?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHBvcnRyYWl0fGVufDB8fDB8fHww' } },
];

const MediaItem = ({ source }) => (
  <View style={styles.mediaItem}>
    <Image source={source} style={styles.mediaImage} />
  </View>
);

export default function Media() {
  const renderItem = ({ item }) => <MediaItem {...item} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Latest Members</Text>
      <FlatList
        data={mediaData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mediaList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  mediaList: {
    paddingHorizontal: 20,
  },
  mediaItem: {
    marginRight: 15,
    borderRadius: 10,
    overflow: 'hidden',
  },
  mediaImage: {
    width: 150,
    height: 200,
    backgroundColor: '#e0e0e0',
  },
});