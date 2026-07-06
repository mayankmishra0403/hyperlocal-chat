import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { getCurrentLocation } from "../services/location";
import AvatarCircle from "../components/AvatarCircle";
import { theme } from "../theme";

export default function CreateGroupScreen() {
  const navigation = useNavigation<any>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert("Error", "Group name is required");
      return;
    }
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      const group = await api.createGroup(
        name.trim(),
        description.trim() || undefined,
        loc.lat,
        loc.lng
      );
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  const isNameValid = name.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrapper} activeOpacity={0.8}>
              <AvatarCircle name={name || "?"} size={80} />
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Add group icon</Text>
          </View>

          <Text style={styles.label}>Group Name</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pizza Night"
              placeholderTextColor={theme.colors.textTertiary}
              maxLength={100}
            />
            <Text
              style={[
                styles.charCount,
                name.length >= 80 && styles.charCountWarn,
                name.length >= 100 && styles.charCountError,
              ]}
            >
              {name.length}/100
            </Text>
          </View>

          <Text style={styles.label}>Description (optional)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this group about?"
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          <View style={styles.infoBanner}>
            <View style={styles.infoBannerAccent} />
            <View style={styles.infoBannerContent}>
              <Ionicons name="time-outline" size={16} color={theme.colors.accentBlue} />
              <Text style={styles.infoBannerText}>
                Groups last 2 hours · Visible within 10km
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!isNameValid || loading) && styles.buttonDisabled,
            ]}
            onPress={handleCreate}
            disabled={!isNameValid || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Group</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgSecondary,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: theme.spacing['2xl'],
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: theme.spacing['3xl'],
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: theme.spacing.sm,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.accentBlue,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.bgSecondary,
  },
  avatarHint: {
    fontSize: theme.typography.sm.fontSize,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  inputWrapper: {
    position: "relative",
    marginBottom: theme.spacing.xl,
  },
  input: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  charCount: {
    position: "absolute",
    bottom: theme.spacing.sm,
    right: theme.spacing.md,
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  charCountWarn: {
    color: theme.colors.accentAmber,
  },
  charCountError: {
    color: theme.colors.accentRed,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: '#F0F7FF',
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing['2xl'],
    overflow: "hidden",
  },
  infoBannerAccent: {
    width: 4,
    backgroundColor: theme.colors.accentBlue,
  },
  infoBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    flex: 1,
  },
  infoBannerText: {
    fontSize: theme.typography.sm.fontSize,
    fontWeight: "500",
    color: theme.colors.textPrimary,
    flex: 1,
  },
  button: {
    backgroundColor: theme.colors.accentBlue,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
