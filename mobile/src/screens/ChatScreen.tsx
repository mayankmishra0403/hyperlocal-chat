import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  getSocket,
  joinGroup,
  leaveGroup,
  sendMessage,
  updateLocation,
  onNewMessage,
  onMessagesList,
  onProximityWarning,
  onMemberRemoved,
  offAll,
} from "../services/socket";
import { getCurrentLocation, startTracking, stopTracking } from "../services/location";
import AvatarCircle from "../components/AvatarCircle";
import { theme } from "../theme";
import type { Message, Group } from "../types";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function shouldShowDateSeparator(current: string, previous?: string): boolean {
  if (!previous) return true;
  const cur = new Date(current);
  const prev = new Date(previous);
  return (
    cur.getDate() !== prev.getDate() ||
    cur.getMonth() !== prev.getMonth() ||
    cur.getFullYear() !== prev.getFullYear()
  );
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ChatBubbleTail({ isOwn }: { isOwn: boolean }) {
  return (
    <View
      style={[
        styles.bubbleTail,
        isOwn ? styles.bubbleTailOwn : styles.bubbleTailOther,
      ]}
    />
  );
}

export default function ChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { groupId } = route.params as { groupId: string };

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [proximityBanner, setProximityBanner] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isAtBottom = useRef(true);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const scrollBtnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const g = await api.getGroup(groupId);
        if (mounted) setGroup(g);
      } catch (err: any) {
        if (mounted) Alert.alert("Error", err?.message ?? "Failed to load group");
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  useEffect(() => {
    let mounted = true;

    const socket = getSocket();
    if (!socket?.connected) {
      if (mounted) {
        Alert.alert("Error", "Not connected to server");
        setLoading(false);
      }
      return;
    }

    joinGroup(groupId);

    const cleanupNewMessage = onNewMessage((msg: Message) => {
      if (mounted) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    const cleanupMessagesList = onMessagesList((msgs: Message[]) => {
      if (mounted) {
        setMessages(msgs);
        setLoading(false);
      }
    });

    const cleanupProximity = onProximityWarning((data) => {
      if (mounted) {
        setProximityBanner(data.message);
        Animated.timing(bannerAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
        setTimeout(() => {
          if (mounted) {
            Animated.timing(bannerAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              if (mounted) setProximityBanner(null);
            });
          }
        }, 8000);
      }
    });

    const cleanupMemberRemoved = onMemberRemoved((data) => {
      if (mounted && data.userId === user?.id) {
        Alert.alert("Removed", "You have been removed from this group.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    });

    getCurrentLocation()
      .then((loc) => updateLocation(groupId, loc))
      .catch(() => {});

    startTracking((coords) => {
      updateLocation(groupId, coords);
    }).catch(() => {});

    const loadingTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      stopTracking();
      cleanupNewMessage();
      cleanupMessagesList();
      cleanupProximity();
      cleanupMemberRemoved();
      leaveGroup(groupId);
      offAll();
    };
  }, [groupId, user?.id, navigation, bannerAnim]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(groupId, "text", trimmed);
    setInput("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, groupId]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    isAtBottom.current = atBottom;
    setShowScrollBottom(!atBottom);
  }, []);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const prevMessage = index > 0 ? messages[index - 1] : undefined;
    const showDateSep = shouldShowDateSeparator(item.created_at, prevMessage?.created_at);

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.created_at)}
            </Text>
          </View>
        )}
        <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
          {!isOwn && (
            <View style={styles.msgAvatar}>
              <AvatarCircle name={item.sender_id} size={36} />
            </View>
          )}
          <View style={[styles.msgColumn, isOwn ? styles.msgColumnOwn : styles.msgColumnOther]}>
            <View
              style={[
                styles.msgBubble,
                isOwn ? styles.msgBubbleOwn : styles.msgBubbleOther,
              ]}
            >
              {item.type !== "text" && (
                <Text style={styles.msgTypeBadge}>
                  [{item.type.charAt(0).toUpperCase() + item.type.slice(1)}]
                </Text>
              )}
              <Text
                style={[
                  styles.msgText,
                  isOwn ? styles.msgTextOwn : styles.msgTextOther,
                ]}
              >
                {item.content}
              </Text>
              <ChatBubbleTail isOwn={isOwn} />
            </View>
            <View style={[styles.msgMeta, isOwn ? styles.msgMetaOwn : styles.msgMetaOther]}>
              <Text style={styles.msgTime}>
                {formatTime(item.created_at)}
              </Text>
              {isOwn && (
                <Ionicons name="checkmark" size={14} color={theme.colors.chatSystemMsg} />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyMessages = () => (
    <View style={styles.emptyMessages}>
      <View style={styles.emptyMessagesIcon}>
        <Ionicons name="chatbubble-ellipses-outline" size={40} color={theme.colors.chatSystemMsg} />
      </View>
      <Text style={styles.emptyMessagesTitle}>No messages yet</Text>
      <Text style={styles.emptyMessagesSubtitle}>
        Send the first message to start the conversation!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.chatSystemMsg} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => navigation.navigate("GroupSettings", { groupId })}
          activeOpacity={0.7}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            {group?.name ?? "Chat"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {group?.member_count ?? 0} members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerMenu}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.navigate("GroupSettings", { groupId })}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {proximityBanner && (
        <Animated.View
          style={[
            styles.banner,
            {
              transform: [{
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              }],
              opacity: bannerAnim,
            },
          ]}
        >
          <View style={styles.bannerAccent} />
          <Ionicons name="flash" size={16} color={theme.colors.accentAmber} />
          <Text style={styles.bannerText} numberOfLines={2}>
            {proximityBanner}
          </Text>
        </Animated.View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.flex}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (isAtBottom.current) flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={renderEmptyMessages}
        />

        {showScrollBottom && (
          <TouchableOpacity
            style={styles.scrollToBottom}
            onPress={scrollToBottom}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-down" size={20} color={theme.colors.chatSystemMsg} />
          </TouchableOpacity>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.inputAttach} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="attach-outline" size={22} color={theme.colors.chatSystemMsg} />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={theme.colors.chatSystemMsg}
              value={input}
              onChangeText={setInput}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          </View>
          <TouchableOpacity style={styles.inputCamera} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="camera-outline" size={22} color={theme.colors.chatSystemMsg} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sendButton,
              !input.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim()}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={18}
              color={input.trim() ? "#FFFFFF" : theme.colors.chatSystemMsg}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.chatBg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.chatHeaderBg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.chatInputField,
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.md.fontSize,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: theme.colors.chatSystemMsg,
    marginTop: 1,
  },
  headerMenu: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.chatProximityBg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.chatInputField,
    gap: theme.spacing.sm,
    overflow: "hidden",
  },
  bannerAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.accentAmber,
  },
  bannerText: {
    flex: 1,
    fontSize: theme.typography.sm.fontSize,
    color: theme.colors.chatTextOther,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.chatBg,
  },
  listContent: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: theme.spacing.md,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.colors.chatSystemMsg,
    backgroundColor: theme.colors.chatProximityBg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  msgRow: {
    marginVertical: 2,
    flexDirection: "row",
    paddingHorizontal: theme.spacing.sm,
  },
  msgRowOwn: {
    justifyContent: "flex-end",
  },
  msgRowOther: {
    justifyContent: "flex-start",
  },
  msgAvatar: {
    marginRight: theme.spacing.sm,
    alignSelf: "flex-end",
  },
  msgColumn: {
    maxWidth: "78%",
  },
  msgColumnOwn: {
    alignItems: "flex-end",
  },
  msgColumnOther: {
    alignItems: "flex-start",
  },
  msgBubble: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "relative",
  },
  msgBubbleOwn: {
    backgroundColor: theme.colors.chatBubbleSelf,
    borderBottomRightRadius: 0,
  },
  msgBubbleOther: {
    backgroundColor: theme.colors.chatBubbleOther,
    borderBottomLeftRadius: 0,
  },
  bubbleTail: {
    position: "absolute",
    bottom: 0,
    width: 8,
    height: 8,
    transform: [{ rotate: "45deg" }],
  },
  bubbleTailOwn: {
    right: -4,
    backgroundColor: theme.colors.chatBubbleSelf,
  },
  bubbleTailOther: {
    left: -4,
    backgroundColor: theme.colors.chatBubbleOther,
  },
  msgTypeBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.chatSystemMsg,
    marginBottom: 2,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 20,
  },
  msgTextOwn: {
    color: theme.colors.chatTextSelf,
  },
  msgTextOther: {
    color: theme.colors.chatTextOther,
  },
  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 3,
  },
  msgMetaOwn: {
    justifyContent: "flex-end",
  },
  msgMetaOther: {
    justifyContent: "flex-start",
  },
  msgTime: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.chatSystemMsg,
  },
  emptyMessages: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing['3xl'],
  },
  emptyMessagesIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.chatInputField,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  emptyMessagesTitle: {
    fontSize: theme.typography.lg.fontSize,
    fontWeight: "700",
    color: theme.colors.chatTextOther,
    marginBottom: theme.spacing.sm,
  },
  emptyMessagesSubtitle: {
    fontSize: theme.typography.sm.fontSize,
    color: theme.colors.chatSystemMsg,
    textAlign: "center",
    lineHeight: 20,
  },
  scrollToBottom: {
    position: "absolute",
    bottom: 72,
    right: theme.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.chatHeaderBg,
    borderWidth: 1,
    borderColor: theme.colors.chatInputField,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.md,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.chatInputBg,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.chatInputField,
  },
  inputAttach: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: theme.colors.chatInputField,
    borderRadius: theme.radius.xl,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    marginHorizontal: theme.spacing.xs,
  },
  input: {
    fontSize: 15,
    color: theme.colors.chatTextSelf,
    padding: 0,
  },
  inputCamera: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.chatBubbleSelf,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.chatHeaderBg,
  },
});
