import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";

const MOCK_MESSAGES = [
  {
    id: "t1",
    type: "timestamp",
    label: "Yesterday",
  },
  {
    id: "m1",
    type: "message",
    userId: "u1",
    text: "Hi",
    timestamp: "13:52",
    status: "delivered",
  },
  {
    id: "m2",
    type: "message",
    userId: "u2",
    text: "Hey! How are you doing?",
    timestamp: "13:53",
  },
  {
    id: "m3",
    type: "message",
    userId: "u1",
    text: "Good, thanks! Just working on this chat UI.",
    timestamp: "13:54",
    status: "sent",
  },
  {
    id: "m4",
    type: "image",
    userId: "u1",
    uri: "https://i.pravatar.cc/300?u=belle",
    timestamp: "13:55",
    status: "sent",
  },
  {
    id: "m5",
    type: "audio",
    userId: "u2",
    uri: null,
    duration: 12000,
    timestamp: "13:56",
  },
];

const MY_USER_ID = "u1";

const OTHER_USER = {
  name: "Jason",
  image: "https://i.pravatar.cc/100?u=puja",
};

const getTimestamp = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatDuration = (millis) => {
  if (millis === null) return "0:00";
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export default function ChatInterface({ navigation }) {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [imageToSend, setImageToSend] = useState(null);
  const [isReadConfirmation, setIsReadConfirmation] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);

  const [currentSound, setCurrentSound] = useState(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null);
  const [playbackPosition, setPlaybackPosition] = useState(null);

  const flatListRef = useRef(null);
  const textInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
      await Audio.requestPermissionsAsync();
    })();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    return currentSound
      ? () => {
          console.log("Unloading Sound on unmount");
          currentSound.unloadAsync();
        }
      : undefined;
  }, [currentSound]);

  const nav = navigation || { goBack: () => console.log("Go Back") };

  const handleGoBack = () => nav.goBack();
  const handleCall = () => console.log("Pressed: Call");

  const handleCamera = () => {
    Alert.alert(
      "Choose Image Source",
      "Select an image from your camera or gallery.",
      [
        {
          text: "Camera",
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({ quality: 1 });
            if (!result.canceled) {
              setImageToSend(result.assets[0].uri);
            }
          },
        },
        {
          text: "Gallery",
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            });
            if (!result.canceled) {
              setImageToSend(result.assets[0].uri);
            }
          },
        },
        { text: "Cancel", style: "destructive" },
      ]
    );
  };

  const handleSend = () => {
    if (inputText.trim().length === 0) return;
    const newMessage = {
      id: `m${Date.now()}`,
      type: "message",
      userId: MY_USER_ID,
      text: inputText.trim(),
      timestamp: getTimestamp(),
      status: "sent",
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputText("");
  };

  const handleSendImage = () => {
    if (!imageToSend) return;
    const newMessage = {
      id: `m${Date.now()}`,
      type: "image",
      userId: MY_USER_ID,
      uri: imageToSend,
      timestamp: getTimestamp(),
      status: "sent",
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setImageToSend(null);
  };

  const dismissPickers = () => Keyboard.dismiss();

  async function startRecording() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = recording.getURI();
    const status = await recording.getStatusAsync();
    const duration = status.durationMillis;
    setRecording(null);
    return { uri, duration };
  }

  const handleMic = async () => {
    if (isRecording) {
      const { uri, duration } = await stopRecording();
      if (!uri) return;

      const newMessage = {
        id: `m${Date.now()}`,
        type: "audio",
        userId: MY_USER_ID,
        uri: uri,
        duration: duration,
        timestamp: getTimestamp(),
        status: "sent",
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    } else {
      await startRecording();
    }
  };

  const handlePlaySound = async (item) => {
    if (item.id === currentlyPlayingId) {
      console.log("Pausing sound");
      if (currentSound) {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      }
      setCurrentSound(null);
      setCurrentlyPlayingId(null);
      setPlaybackPosition(null);
      return;
    }

    if (currentSound) {
      console.log("Stopping previous sound");
      currentSound.setOnPlaybackStatusUpdate(null);
      await currentSound.stopAsync();
      await currentSound.unloadAsync();

      setCurrentSound(null);
      setCurrentlyPlayingId(null);
      setPlaybackPosition(null);
    }

    if (!item.uri) {
      Alert.alert(
        "Error",
        "This mock message doesn't have a valid audio file."
      );
      return;
    }

    console.log(`Loading Sound ${item.id}`);
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: item.uri });

      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis);

          if (status.didJustFinish) {
            console.log(`Playback finished for ${item.id}. Cleaning up.`);
            await sound.unloadAsync();
            setPlaybackPosition(null);

            setCurrentlyPlayingId((prevId) => {
              if (prevId === item.id) {
                setCurrentSound(null);
                return null;
              }
              return prevId;
            });
          }
        }
      });

      setCurrentSound(sound);
      setCurrentlyPlayingId(item.id);
      setPlaybackPosition(0);
      await sound.playAsync();
      console.log(`Playing Sound ${item.id}`);
    } catch (error) {
      console.error("Failed to play sound", error);
    }
  };

  const renderMessageItem = useCallback(
    ({ item }) => {
      if (item.type === "timestamp") {
        return <Text style={styles.timestamp}>{item.label}</Text>;
      }

      const isMyMessage = item.userId === MY_USER_ID;

      if (item.type === "audio") {
        const isPlaying = item.id === currentlyPlayingId;
        const progress =
          playbackPosition && isPlaying && item.duration
            ? (playbackPosition / item.duration) * 100
            : 0;
        const durationLabel = isPlaying
          ? formatDuration(playbackPosition)
          : formatDuration(item.duration);

        return (
          <View
            style={[
              styles.messageRow,
              isMyMessage ? styles.myMessageRow : styles.otherMessageRow,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                isMyMessage
                  ? styles.myMessageBubble
                  : styles.otherMessageBubble,
                styles.audioBubble,
              ]}
            >
              <TouchableOpacity onPress={() => handlePlaySound(item)}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={24}
                  color={isMyMessage ? "#FFFFFF" : "#000000"}
                />
              </TouchableOpacity>

              <View style={styles.audioProgressContainer}>
                <View
                  style={[
                    styles.audioProgressBar,
                    {
                      width: `${progress}%`,
                      backgroundColor: isMyMessage ? "#FFFFFF" : "#000000",
                    },
                  ]}
                />
              </View>

              <Text
                style={[
                  styles.audioDurationText,
                  { color: isMyMessage ? "#A0A0A0" : "#6B7280" },
                ]}
              >
                {durationLabel}
              </Text>

              <View
                style={[
                  styles.messageTimeContainer,
                  { alignSelf: "center", marginTop: 0, marginLeft: 5 },
                ]}
              >
                <Text
                  style={
                    isMyMessage ? styles.myMessageTime : styles.otherMessageTime
                  }
                >
                  {item.timestamp}
                </Text>
                {isMyMessage && (
                  <Ionicons
                    name={
                      item.status === "delivered"
                        ? "checkmark-done"
                        : "checkmark"
                    }
                    size={14}
                    color="#A0A0A0"
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
            </View>
          </View>
        );
      }

      if (item.type === "image") {
        return (
          <View
            style={[
              styles.messageRow,
              isMyMessage ? styles.myMessageRow : styles.otherMessageRow,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                isMyMessage
                  ? styles.myMessageBubble
                  : styles.otherMessageBubble,
              ]}
            >
              <Image source={{ uri: item.uri }} style={styles.messageImage} />
              <View style={styles.messageTimeContainer}>
                <Text
                  style={
                    isMyMessage ? styles.myMessageTime : styles.otherMessageTime
                  }
                >
                  {item.timestamp}
                </Text>
                {isMyMessage && (
                  <Ionicons
                    name={
                      item.status === "delivered"
                        ? "checkmark-done"
                        : "checkmark"
                    }
                    size={14}
                    color="#A0A0A0"
                    style={{ marginLeft: 3 }}
                  />
                )}
              </View>
            </View>
          </View>
        );
      }

      return (
        <View
          style={[
            styles.messageRow,
            isMyMessage ? styles.myMessageRow : styles.otherMessageRow,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text
              style={
                isMyMessage ? styles.myMessageText : styles.otherMessageText
              }
            >
              {item.text}
            </Text>
            <View style={styles.messageTimeContainer}>
              <Text
                style={
                  isMyMessage ? styles.myMessageTime : styles.otherMessageTime
                }
              >
                {item.timestamp}
              </Text>
              {isMyMessage && (
                <Ionicons
                  name={
                    item.status === "delivered" ? "checkmark-done" : "checkmark"
                  }
                  size={14}
                  color="#A0A0A0"
                  style={{ marginLeft: 3 }}
                />
              )}
            </View>
          </View>
        </View>
      );
    },
    [currentlyPlayingId, playbackPosition]
  );

  return (
    <LinearGradient colors={["#FFFFFF", "#F3F4F6"]} style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior="padding" style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
            <Image
              source={{ uri: OTHER_USER.image }}
              style={styles.profilePic}
            />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerName}>{OTHER_USER.name}</Text>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color="#000000"
                style={{ marginLeft: 4 }}
              />
            </View>
            <View style={styles.headerIconsRight}>
              <TouchableOpacity onPress={handleCall} style={styles.headerIcon}>
                <Ionicons name="call-outline" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={{ paddingBottom: 10 }}
            onScrollBeginDrag={dismissPickers}
          />

          <TouchableOpacity
            style={styles.readConfirmationTouchable}
            onPress={() => setIsReadConfirmation((prev) => !prev)}
          >
            <Ionicons
              name={isReadConfirmation ? "checkmark" : "checkmark-outline"}
              size={16}
              color="#6B7280"
            />
            <Text style={styles.readConfirmationText}>
              Request read confirmation
            </Text>
          </TouchableOpacity>

          {imageToSend && !isRecording && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: imageToSend }}
                style={styles.imagePreview}
              />
              <TouchableOpacity
                onPress={() => setImageToSend(null)}
                style={styles.closePreviewButton}
              >
                <Ionicons name="close-circle" size={24} color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSendImage}
                style={styles.sendImageButton}
              >
                <Ionicons name="send" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            {isRecording ? (
              <View style={styles.recordingContainer}>
                <Ionicons
                  name="mic-circle"
                  size={26}
                  color="#FF0000"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.recordingText}>Recording...</Text>
              </View>
            ) : (
              <>
                <TextInput
                  ref={textInputRef}
                  style={styles.textInput}
                  placeholder="Type message..."
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                />
                {inputText.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setInputText("")}
                    style={styles.footerIcon}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={26}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleCamera}
                  style={styles.footerIcon}
                >
                  <Ionicons name="camera-outline" size={26} color="#6B7280" />
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={inputText.length > 0 ? handleSend : handleMic}
              style={styles.footerIcon}
              disabled={inputText.length > 0 && isRecording}
            >
              <Ionicons
                name={
                  inputText.length > 0
                    ? "paper-plane"
                    : isRecording
                    ? "stop-circle-outline"
                    : "mic-outline"
                }
                size={26}
                color={
                  isRecording
                    ? "#FF0000"
                    : inputText.length > 0
                    ? "#000000"
                    : "#6B7280"
                }
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 16,
    marginRight: 10,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000000",
  },
  headerIconsRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  headerIcon: {
    marginLeft: 20,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  timestamp: {
    alignSelf: "center",
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
    marginVertical: 15,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    maxWidth: "75%",
  },
  myMessageBubble: {
    backgroundColor: "#000000",
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "#F3F4F6",
    borderBottomLeftRadius: 4,
  },
  myMessageText: {
    fontSize: 15,
    color: "#FFFFFF",
  },
  otherMessageText: {
    fontSize: 15,
    color: "#000000",
  },
  messageTimeContainer: {
    flexDirection: "row",
    alignSelf: "flex-end",
    marginTop: 4,
    marginLeft: 10,
  },
  myMessageTime: {
    fontSize: 11,
    color: "#A0A0A0",
  },
  otherMessageTime: {
    fontSize: 11,
    color: "#6B7280",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  audioBubble: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: "60%",
  },
  audioProgressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: "#9CA3AF",
    borderRadius: 2,
    marginHorizontal: 10,
  },
  audioProgressBar: {
    height: 4,
    borderRadius: 2,
  },
  audioDurationText: {
    fontSize: 11,
    fontWeight: "500",
    minWidth: 30,
  },
  readConfirmationTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  readConfirmationText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginLeft: 5,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#F9FAFB",
    marginRight: 8,
  },
  footerIcon: {
    padding: 6,
    marginHorizontal: 4,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
    marginRight: 8,
  },
  recordingText: {
    fontSize: 15,
    color: "#FF0000",
    fontWeight: "500",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#F3F4F6",
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 10,
  },
  closePreviewButton: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 12,
  },
  sendImageButton: {
    position: "absolute",
    bottom: 15,
    right: 15,
    backgroundColor: "#000000",
    borderRadius: 25,
    padding: 10,
  },
});
