import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import AvatarCircle from "../components/AvatarCircle";
import { theme } from "../theme";
import type { Group, GroupMember } from "../types";

function formatExpiryRemaining(expiresAt: string): string {
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

function formatExpiryDate(expiresAt: string): string {
  const d = new Date(expiresAt);
  return d.toLocaleString();
}

function formatMemberStatus(member: GroupMember, currentUserId: string): string {
  if (member.user_id === currentUserId && member.role === "admin") return "You · Admin";
  if (member.user_id === currentUserId) return "You";
  if (member.role === "admin") return "Admin";
  return "Member";
}

function getMemberStatusDetail(member: GroupMember, currentUserId: string): string {
  if (member.user_id === currentUserId && member.role === "admin") return "You are the admin";
  if (member.user_id === currentUserId) return "You";
  if (member.role === "admin") return "Active now";
  return "Last seen recently";
}

export default function GroupSettingsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { groupId } = route.params as { groupId: string };

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [countdown, setCountdown] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        const [g, m] = await Promise.all([
          api.getGroup(groupId),
          api.getGroupMembers(groupId),
        ]);
        if (mounted) {
          setGroup(g);
          setMembers(m);
        }
      } catch (err: any) {
        if (mounted) {
          Alert.alert("Error", err?.message ?? "Failed to load group settings");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (!group) return;
    const g = group;

    function tick() {
      setCountdown(formatExpiryRemaining(g.expires_at));
    }

    tick();
    intervalRef.current = setInterval(tick, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [group]);

  const isAdmin = group?.created_by === user?.id;
  const isExpired = group ? new Date(group.expires_at).getTime() <= Date.now() : false;
  const ownerName = group?.created_by === user?.id ? "You" : group?.created_by;

  const handleExtend = async () => {
    setExtending(true);
    try {
      const updated = await api.extendGroup(groupId);
      setGroup(updated);
      Alert.alert("Extended", "Group time extended by 1 hour.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to extend group");
    } finally {
      setExtending(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              await api.leaveGroup(groupId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to leave group");
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Group",
      "Are you sure you want to delete this group? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              await api.deleteGroup(groupId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to delete group");
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      await api.getGroup(groupId);
      Alert.alert("Share", "Share this group with friends!");
    } catch (_) {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accentBlue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            <AvatarCircle name={group?.name ?? "?"} size={80} />
          </View>
          <Text style={styles.heroTitle}>{group?.name}</Text>
          <Text style={styles.heroMeta}>
            Created by {ownerName} · {countdown || formatExpiryRemaining(group?.expires_at ?? "")}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.textPrimary} />
          <Text style={styles.sectionTitle}>Group Info</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Description</Text>
            <Text style={styles.infoValue}>
              {group?.description?.trim() ? group.description : "No description"}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expires</Text>
            <Text style={styles.infoValue}>{formatExpiryDate(group?.expires_at ?? "")}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Visibility</Text>
            <Text style={styles.infoValue}>Within 10km</Text>
          </View>
          {group?.extended ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Extended</Text>
                <Text style={styles.infoValue}>1 time</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={18} color={theme.colors.textPrimary} />
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
        </View>
        <View style={styles.card}>
          {members.map((member) => {
            const memberName = member.user_id === user?.id ? "You" : member.user_id;
            const isMemberAdmin = member.role === "admin";
            const statusText = getMemberStatusDetail(member, user?.id ?? "");
            return (
              <View key={member.id}>
                <View style={styles.memberRow}>
                  <AvatarCircle name={member.user_id} size={40} />
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {memberName}
                      </Text>
                      {isMemberAdmin && (
                        <View style={styles.adminBadge}>
                          <Ionicons name="shield" size={12} color={theme.colors.accentBlue} />
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberStatus}>{statusText}</Text>
                  </View>
                  <View style={styles.memberStatusDot} />
                </View>
                <View style={styles.memberDivider} />
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.countdownCard,
            isExpired && styles.countdownCardExpired,
          ]}
        >
          <Ionicons
            name="time-outline"
            size={24}
            color={isExpired ? theme.colors.accentRed : theme.colors.accentAmber}
          />
          <Text
            style={[
              styles.countdownText,
              isExpired && styles.countdownTextExpired,
            ]}
          >
            {countdown || formatExpiryRemaining(group?.expires_at ?? "")}
          </Text>
        </View>

        <View style={styles.actionsSection}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.extendButton}
              onPress={handleExtend}
              disabled={extending}
              activeOpacity={0.7}
            >
              {extending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.extendButtonText}>Extend Group by 1 Hour</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={18} color={theme.colors.textPrimary} />
            <Text style={styles.shareButtonText}>Share Group Invite</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeave}
            disabled={leaving}
            activeOpacity={0.7}
          >
            {leaving ? (
              <ActivityIndicator size="small" color={theme.colors.accentRed} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={18} color={theme.colors.accentRed} />
                <Text style={styles.leaveButtonText}>Leave Group</Text>
              </>
            )}
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={leaving}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}>Delete Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    paddingBottom: theme.spacing['5xl'],
  },
  heroCard: {
    alignItems: "center",
    paddingVertical: theme.spacing['2xl'],
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.md,
  },
  heroAvatar: {
    marginBottom: theme.spacing.lg,
  },
  heroTitle: {
    fontSize: theme.typography.xl.fontSize,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  heroMeta: {
    fontSize: 14,
    fontWeight: "400",
    color: theme.colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.md.fontSize,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  card: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "400",
    color: theme.colors.textPrimary,
    flex: 2,
    textAlign: "right",
  },
  infoDivider: {
    height: 1,
    backgroundColor: theme.colors.bgTertiary,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  memberInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.textPrimary,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.badgeBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    gap: 3,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.accentBlue,
  },
  memberStatus: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  memberStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accentGreen,
    marginLeft: theme.spacing.sm,
  },
  memberDivider: {
    height: 1,
    backgroundColor: theme.colors.bgTertiary,
  },
  countdownCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentAmber,
  },
  countdownCardExpired: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: theme.colors.accentRed,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: "700",
    color: '#92400E',
  },
  countdownTextExpired: {
    color: theme.colors.accentRed,
  },
  actionsSection: {
    gap: theme.spacing.md,
  },
  extendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentBlue,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    minHeight: 48,
    gap: theme.spacing.sm,
  },
  extendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    minHeight: 48,
    gap: theme.spacing.sm,
  },
  shareButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FED7D7',
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    minHeight: 48,
    gap: theme.spacing.sm,
  },
  leaveButtonText: {
    color: theme.colors.accentRed,
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentRed,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    minHeight: 48,
    gap: theme.spacing.sm,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
