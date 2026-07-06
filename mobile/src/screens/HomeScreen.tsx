import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getCurrentLocation } from "../services/location";
import AvatarCircle from "../components/AvatarCircle";
import { theme } from "../theme";
import type { Group } from "../types";

function formatExpiry(expiresAt: string): string {
  const now = Date.now();
  const diffMs = new Date(expiresAt).getTime() - now;

  if (diffMs <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m remaining`;
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [nearbyGroups, setNearbyGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "nearby">("my");

  const fetchMyGroups = useCallback(async () => {
    try {
      const mine = await api.getMyGroups();
      setMyGroups(mine);
    } catch (_) {}
  }, []);

  const fetchNearby = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const { lat, lng } = await getCurrentLocation();
      const nearby = await api.getNearbyGroups(lat, lng);
      setNearbyGroups(nearby);
    } catch (err: any) {
      setNearbyError(err?.message ?? "Could not load nearby groups");
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setLoading(true);
        await fetchMyGroups();
        if (!cancelled) setLoading(false);
      }

      load();
      return () => { cancelled = true; };
    }, [fetchMyGroups])
  );

  useEffect(() => {
    if (activeTab === "nearby" && nearbyGroups.length === 0 && !nearbyLoading) {
      fetchNearby();
    }
  }, [activeTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyGroups();
    if (activeTab === "nearby") await fetchNearby();
    setRefreshing(false);
  }, [fetchMyGroups, fetchNearby, activeTab]);

  const handleJoinGroup = async (groupId: string) => {
    setJoining(groupId);
    try {
      await api.joinGroup(groupId);
      navigation.navigate("Chat", { groupId });
    } catch (err: any) {
      Alert.alert("Join Error", err?.message ?? "Could not join group.");
    } finally {
      setJoining(null);
    }
  };

  const handleOpenGroup = (groupId: string) => {
    navigation.navigate("Chat", { groupId });
  };

  const handleCreateGroup = () => {
    navigation.navigate("CreateGroup");
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      Alert.alert("Logout Error", err?.message ?? "Something went wrong.");
    }
  };

  const renderGroupCard = ({ item }: { item: Group }) => {
    const expired = new Date(item.expires_at).getTime() <= Date.now();
    const isMyGroup = activeTab === "my";
    const truncatedDescription =
      item.description && item.description.length > 80
        ? item.description.slice(0, 80) + "..."
        : item.description;

    return (
      <TouchableOpacity
        style={[styles.groupCard, expired && styles.groupCardExpired]}
        onPress={() => (isMyGroup ? handleOpenGroup(item.id) : handleJoinGroup(item.id))}
        disabled={joining === item.id || expired}
        activeOpacity={0.7}
      >
        <View style={styles.groupCardInner}>
          <AvatarCircle name={item.name} size={40} />
          <View style={styles.groupCardContent}>
            <View style={styles.groupCardHeader}>
              <Text style={styles.groupCardName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.memberCountRow}>
                <Ionicons name="people-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={styles.memberCountText}>
                  {item.member_count ?? 0}
                </Text>
              </View>
            </View>
            {truncatedDescription ? (
              <Text style={styles.groupCardDescription} numberOfLines={2}>
                {truncatedDescription}
              </Text>
            ) : null}
            <View style={styles.groupCardFooter}>
              <View style={styles.expiryRow}>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={expired ? theme.colors.accentRed : theme.colors.textTertiary}
                />
                <Text style={[styles.expiryText, expired && styles.expiredText]}>
                  {formatExpiry(item.expires_at)}
                </Text>
              </View>
              {joining === item.id ? (
                <ActivityIndicator size="small" color={theme.colors.accentGreen} />
              ) : isMyGroup ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate("GroupSettings", { groupId: item.id })}
                  style={styles.settingsIconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="settings-outline" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>Join</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const isMyTab = activeTab === "my";
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name={isMyTab ? "chatbubbles-outline" : "location-outline"}
            size={40}
            color={theme.colors.borderLight}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isMyTab ? "No groups yet" : "No groups nearby"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isMyTab
            ? "Create your first group to start chatting nearby!"
            : "No one has created a group in your area yet. Be the first!"}
        </Text>
        <TouchableOpacity style={styles.emptyCta} onPress={handleCreateGroup} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.emptyCtaText}>
            {isMyTab ? "Create Your First Group" : "Create a Group"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accentBlue} />
          <Text style={styles.loadingText}>Finding groups near you...</Text>
        </View>
      );
    }

    const data = activeTab === "my" ? myGroups : nearbyGroups;
    const isLoadingNearby = activeTab === "nearby" && nearbyLoading && data.length === 0;
    const hasError = activeTab === "nearby" && nearbyError && data.length === 0;

    if (isLoadingNearby) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accentBlue} />
          <Text style={styles.loadingText}>Finding groups near you...</Text>
        </View>
      );
    }

    if (hasError) {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="warning-outline" size={48} color={theme.colors.accentRed} />
          <Text style={styles.errorText}>{nearbyError}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accentBlue}
            colors={[theme.colors.accentBlue]}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Hyperlocal</Text>
          {user && (
            <Text style={styles.headerGreeting}>Hi, {user.display_name}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="log-out-outline" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.segmentedTab}>
        <View style={styles.segmentedTabInner}>
          <TouchableOpacity
            style={[styles.segmentedTabItem, activeTab === "my" && styles.segmentedTabItemActive]}
            onPress={() => setActiveTab("my")}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentedTabText, activeTab === "my" && styles.segmentedTabTextActive]}>
              My Groups
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentedTabItem, activeTab === "nearby" && styles.segmentedTabItemActive]}
            onPress={() => setActiveTab("nearby")}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentedTabText, activeTab === "nearby" && styles.segmentedTabTextActive]}>
              Nearby
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderContent()}

      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateGroup}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.bgSecondary,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: {
    fontSize: theme.typography.lg.fontSize,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  headerGreeting: {
    fontSize: theme.typography.sm.fontSize,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedTab: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  segmentedTabInner: {
    flexDirection: "row",
    height: 32,
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.radius.full,
    padding: 2,
  },
  segmentedTabItem: {
    flex: 1,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedTabItemActive: {
    backgroundColor: theme.colors.bgSecondary,
    ...theme.shadow.sm,
  },
  segmentedTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
  segmentedTabTextActive: {
    fontWeight: "600",
    color: theme.colors.accentBlue,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sm.fontSize,
    color: theme.colors.textSecondary,
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sm.fontSize,
    color: theme.colors.accentRed,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 100,
  },
  groupCard: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadow.sm,
  },
  groupCardExpired: {
    opacity: 0.45,
  },
  groupCardInner: {
    flexDirection: "row",
  },
  groupCardContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  groupCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  groupCardName: {
    fontSize: theme.typography.md.fontSize,
    fontWeight: "600",
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  memberCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  memberCountText: {
    fontSize: theme.typography.sm.fontSize,
    color: theme.colors.textSecondary,
  },
  groupCardDescription: {
    fontSize: theme.typography.sm.fontSize,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  groupCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expiryText: {
    fontSize: theme.typography.xs.fontSize,
    fontWeight: "500",
    color: theme.colors.textTertiary,
  },
  expiredText: {
    color: theme.colors.accentRed,
  },
  settingsIconBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  joinButton: {
    backgroundColor: theme.colors.accentGreen,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: theme.spacing['2xl'],
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.badgeBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.borderLight,
    borderStyle: "dashed",
    marginBottom: theme.spacing['2xl'],
  },
  emptyTitle: {
    fontSize: theme.typography.xl.fontSize,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.typography.base.fontSize,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: theme.spacing['2xl'],
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentBlue,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing['2xl'],
    gap: theme.spacing.sm,
  },
  emptyCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: theme.spacing['2xl'],
    bottom: theme.spacing['2xl'],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accentBlue,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.fab,
  },
});
