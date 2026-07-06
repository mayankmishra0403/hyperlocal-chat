import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";
import { verifyTruecaller } from "../../modules/expo-truecaller";

function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

export default function LoginScreen() {
  const { checkPhone, directLogin, loginExisting, sendOtp, verifyOtp, truecallerVerify, loading } = useAuth();
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"phone" | "register" | "otp">("phone");
  const [checking, setChecking] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [shaking, setShaking] = useState(false);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step === "register" ? 0.33 : step === "otp" ? 0.66 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  function startResendTimer() {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function resetOtp() {
    setOtpDigits(["", "", "", "", "", ""]);
  }

  function triggerShake() {
    setShaking(true);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start(() => setShaking(false));
  }

  function handleOtpChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, "").slice(0, 1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join("");
    if (fullCode.length === 6) {
      handleVerifyOtpCode(fullCode);
    }
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(text: string) {
    const digits = text.replace(/[^0-9]/g, "").split("");
    const newDigits = [...otpDigits];
    for (let i = 0; i < Math.min(6, digits.length); i++) {
      newDigits[i] = digits[i];
    }
    setOtpDigits(newDigits);
    if (digits.length >= 6) {
      const fullCode = newDigits.join("");
      handleVerifyOtpCode(fullCode);
    }
  }

  const handleSubmitPhone = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      Alert.alert("Validation", "Please enter your phone number.");
      return;
    }

    setChecking(true);
    try {
      const exists = await checkPhone(trimmedPhone);
      if (exists) {
        await loginExisting(trimmedPhone);
      } else {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setStep("register");
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Something went wrong");
    } finally {
      setChecking(false);
    }
  };

  const handleTruecallerVerify = async () => {
    setChecking(true);
    try {
      const result = await verifyTruecaller();
      if (result.requestId && result.phoneNumber) {
        await truecallerVerify(result.requestId, result.phoneNumber);
      } else {
        Alert.alert("Error", "Incomplete data from Truecaller");
      }
    } catch (err: any) {
      if (
        err?.message?.includes("VERIFICATION_REQUIRED") ||
        err?.message?.includes("TRUECALLER_FAILED") ||
        err?.message?.includes("INVALID_DATA")
      ) {
        Alert.alert(
          "Truecaller Unavailable",
          "Please use phone number & OTP instead."
        );
      } else {
        Alert.alert("Error", err?.message ?? "Truecaller verification failed");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleSubmitRegister = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert("Validation", "Please enter your display name.");
      return;
    }

    setChecking(true);
    try {
      await sendOtp(phone.trim());
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setStep("otp");
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
        startResendTimer();
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Something went wrong");
    } finally {
      setChecking(false);
    }
  };

  const handleVerifyOtpCode = async (code: string) => {
    if (code.length !== 6) return;
    try {
      await verifyOtp(phone.trim(), code, displayName.trim());
    } catch (err: any) {
      triggerShake();
      resetOtp();
      otpRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || checking) return;
    setChecking(true);
    try {
      await sendOtp(phone.trim());
      resetOtp();
      startResendTimer();
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to resend");
    } finally {
      setChecking(false);
    }
  };

  const handleChangeNumber = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep("phone");
      resetOtp();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0%", "50%", "100%"],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="chatbubble-ellipses" size={32} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.title}>Welcome to Hyperlocal</Text>
          <Text style={styles.subtitle}>Chat with people nearby</Text>

          <View style={styles.stepIndicator}>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <View style={styles.stepLabels}>
              <Text style={[styles.stepLabel, step === "phone" && styles.stepLabelActive]}>
                Phone
              </Text>
              <Text style={[styles.stepLabel, step === "register" && styles.stepLabelActive]}>
                Name
              </Text>
              <Text style={[styles.stepLabel, step === "otp" && styles.stepLabelActive]}>
                Verify
              </Text>
            </View>
          </View>

          <Animated.View style={{ opacity: fadeAnim }}>
            {step === "phone" && (
              <View style={styles.form}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="98765 43210"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, (loading || checking) && styles.buttonDisabled]}
                  onPress={handleSubmitPhone}
                  disabled={loading || checking}
                  activeOpacity={0.8}
                >
                  {loading || checking ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Continue</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.divider} />
                </View>

                <TouchableOpacity
                  style={[styles.truecallerButton, checking && { opacity: 0.5 }]}
                  onPress={handleTruecallerVerify}
                  disabled={checking}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={20} color="#fff" />
                  <Text style={styles.truecallerButtonText}>
                    {checking ? "Verifying..." : "Verify with Truecaller"}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.termsText}>
                  By continuing, you agree to our Terms & Privacy Policy
                </Text>
              </View>
            )}

            {step === "register" && (
              <View style={styles.form}>
                <Text style={styles.label}>Set your display name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name..."
                  placeholderTextColor={theme.colors.textTertiary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!loading}
                />

                <TouchableOpacity
                  style={[styles.button, (!displayName.trim() || checking) && styles.buttonDisabled]}
                  onPress={handleSubmitRegister}
                  disabled={!displayName.trim() || checking}
                  activeOpacity={0.8}
                >
                  {checking ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={handleChangeNumber}
                  disabled={loading}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.backLinkText}>Change number</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === "otp" && (
              <View style={styles.form}>
                <Text style={styles.otpHeader}>Enter verification code</Text>
                <Text style={styles.otpSentTo}>Sent to +91 {maskPhone(phone)}</Text>

                <Animated.View
                  style={[
                    styles.otpRow,
                    shaking && { transform: [{ translateX: shakeAnim }] },
                  ]}
                >
                  {otpDigits.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(ref) => { otpRefs.current[i] = ref; }}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                      ]}
                      value={digit}
                      onChangeText={(t) => {
                        if (t.length > 1) {
                          handleOtpPaste(t);
                        } else {
                          handleOtpChange(t, i);
                        }
                      }}
                      onKeyPress={({ nativeEvent }) =>
                        handleOtpKeyPress(nativeEvent.key, i)
                      }
                      keyboardType="number-pad"
                      maxLength={6}
                      caretHidden
                      selectTextOnFocus
                      editable={!loading}
                    />
                  ))}
                </Animated.View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    (otpDigits.join("").length !== 6 || loading) && styles.buttonDisabled,
                  ]}
                  onPress={() => handleVerifyOtpCode(otpDigits.join(""))}
                  disabled={otpDigits.join("").length !== 6 || loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Verify & Login</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.otpActions}>
                  {resendTimer > 0 ? (
                    <Text style={styles.resendTimer}>
                      Resend in {resendTimer}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={checking}>
                      <Text style={styles.resendButton}>
                        {checking ? "Sending..." : "Resend OTP"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={handleChangeNumber}
                  disabled={loading}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.backLinkText}>Change number</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing['5xl'],
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: theme.spacing['2xl'],
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.accentBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: theme.spacing['3xl'],
  },
  stepIndicator: {
    alignItems: "center",
    marginBottom: theme.spacing['3xl'],
  },
  progressBg: {
    width: 200,
    height: 4,
    backgroundColor: theme.colors.borderLight,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: theme.colors.accentBlue,
    borderRadius: 2,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    marginTop: theme.spacing.sm,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.textTertiary,
  },
  stepLabelActive: {
    color: theme.colors.accentBlue,
    fontWeight: "600",
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xl,
  },
  phoneInputRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.xl,
  },
  countryCode: {
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: "center",
    borderRightWidth: 0,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  button: {
    backgroundColor: theme.colors.accentBlue,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.sm,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  termsText: {
    fontSize: 12,
    fontWeight: "400",
    color: theme.colors.textTertiary,
    textAlign: "center",
    marginTop: theme.spacing.lg,
  },
  otpHeader: {
    fontSize: theme.typography.xl.fontSize,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  otpSentTo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: theme.spacing['2xl'],
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing['2xl'],
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgSecondary,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    padding: 0,
  },
  otpBoxFilled: {
    borderColor: theme.colors.accentBlue,
    backgroundColor: '#F0F7FF',
  },
  otpActions: {
    alignItems: "center",
    marginTop: theme.spacing.lg,
    minHeight: 24,
  },
  resendTimer: {
    fontSize: 14,
    color: theme.colors.textTertiary,
  },
  resendButton: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.accentBlue,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  backLinkText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: theme.spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
  dividerText: {
    marginHorizontal: theme.spacing.md,
    color: theme.colors.textTertiary,
    fontSize: 13,
    fontWeight: "500",
  },
  truecallerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1DA1F2",
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    gap: theme.spacing.sm,
    minHeight: 52,
  },
  truecallerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
