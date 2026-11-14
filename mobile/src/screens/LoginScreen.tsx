import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import BrandMark from "../components/BrandMark";
import IndigoFill from "../components/IndigoFill";
import { colors, radius, typography } from "../theme";

/** Midnight Indigo — solid fill resists Android autofill olive/yellow tint */
const INPUT_SURFACE = colors.cardSurface;

const NETWORK_ERROR_COPY =
  "Unable to connect to server. Please check your Wi-Fi or internet connection.";

type PortalTab = "student" | "driver";

const TAB_COPY: Record<
  PortalTab,
  { subtitle: string; emailPlaceholder: string }
> = {
  student: {
    subtitle: "Access your digital QR bus pass & live route",
    emailPlaceholder: "student@university.edu",
  },
  driver: {
    subtitle: "Start trips, share live GPS & scan student passes",
    emailPlaceholder: "driver@university.edu",
  },
};

export default function LoginScreen() {
  const { login } = useAuth();
  const [portal, setPortal] = useState<PortalTab>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = TAB_COPY[portal];

  function selectPortal(next: PortalTab) {
    setPortal(next);
    setError(null);
  }

  async function onLogin() {
    setError(null);
    setBusy(true);
    try {
      // expectedRole is UI-only; AuthContext never sends it to the API
      await login(email.trim(), password, portal);
    } catch (e: unknown) {
      const axiosLike = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      const serverError = axiosLike?.response?.data?.error;
      const message = axiosLike?.message;
      if (serverError) {
        setError(serverError);
      } else if (
        message &&
        (/network error/i.test(message) ||
          /unable to connect/i.test(message) ||
          /wifi/i.test(message))
      ) {
        setError(NETWORK_ERROR_COPY);
      } else {
        setError(message || "Login failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.card}>
          <View style={styles.brandBlock}>
            <BrandMark />
            <Text style={styles.brandSubtitle}>UNIVERSITY SMART TRANSPORT</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.muted}>{copy.subtitle}</Text>

          <View style={styles.segmentTrack}>
            <PortalSegment
              label="Student"
              icon="school-outline"
              selected={portal === "student"}
              onPress={() => selectPortal("student")}
            />
            <PortalSegment
              label="Driver"
              icon="bus-outline"
              selected={portal === "driver"}
              onPress={() => selectPortal("driver")}
            />
          </View>

          <View
            style={[
              styles.inputShell,
              emailFocused && styles.inputShellFocused,
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={colors.muted}
              style={styles.fieldIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={copy.emailPlaceholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              importantForAutofill="no"
              underlineColorAndroid="transparent"
              selectionColor={colors.ctaIndigo}
              cursorColor={colors.ctaIndigo}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View
            style={[
              styles.inputShell,
              styles.passwordShell,
              passwordFocused && styles.inputShellFocused,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.muted}
              style={styles.fieldIcon}
            />
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              importantForAutofill="no"
              underlineColorAndroid="transparent"
              selectionColor={colors.ctaIndigo}
              cursorColor={colors.ctaIndigo}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
              hitSlop={8}
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.muted}
              />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.buttonWrap,
              pressed && styles.buttonPressed,
              busy && styles.buttonDisabled,
            ]}
            onPress={onLogin}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            <IndigoFill style={styles.buttonFill}>
              {busy ? (
                <ActivityIndicator color={colors.onFilled} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Sign In</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={colors.onFilled}
                  />
                </View>
              )}
            </IndigoFill>
          </Pressable>

          <View style={styles.securityFooter}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={colors.muted}
              style={styles.securityIcon}
            />
            <Text style={styles.securityText}>
              Authorized university students & transport staff only.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PortalSegment({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const content = (
    <>
      <Ionicons
        name={icon}
        size={16}
        color={selected ? colors.onFilled : colors.muted}
      />
      <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
        {label}
      </Text>
    </>
  );

  if (selected) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        onPress={onPress}
        style={styles.segmentPressable}
      >
        <IndigoFill tone="pill" style={styles.segmentSelected}>
          {content}
        </IndigoFill>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
      onPress={onPress}
      style={styles.segmentIdle}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: INPUT_SURFACE,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.28)",
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  brandBlock: {
    marginBottom: 20,
    gap: 8,
  },
  brandSubtitle: {
    ...typography.label,
    color: colors.muted,
    letterSpacing: 1.6,
    fontSize: 11,
    fontWeight: "600",
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: 6,
  },
  muted: {
    ...typography.body,
    color: colors.muted,
    marginBottom: 18,
    lineHeight: 22,
  },
  segmentTrack: {
    flexDirection: "row",
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  segmentPressable: {
    flex: 1,
  },
  segmentSelected: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  segmentIdle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  segmentLabel: {
    ...typography.label,
    color: colors.muted,
    fontSize: 13,
  },
  segmentLabelActive: {
    color: colors.onFilled,
  },
  inputShell: {
    backgroundColor: INPUT_SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  inputShellFocused: {
    borderColor: colors.ctaIndigo,
  },
  passwordShell: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldIcon: {
    marginLeft: 14,
    opacity: 0.85,
  },
  input: {
    flex: 1,
    backgroundColor: INPUT_SURFACE,
    paddingVertical: 14,
    paddingHorizontal: 12,
    color: "#FFFFFF",
    fontSize: 16,
    ...(Platform.OS === "android"
      ? {
          includeFontPadding: false,
        }
      : null),
  },
  passwordInput: {
    paddingRight: 8,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonFill: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: 12,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    ...typography.button,
    color: colors.onFilled,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  error: {
    color: "#FECACA",
    lineHeight: 20,
    fontSize: 14,
  },
  securityFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 4,
  },
  securityIcon: {
    opacity: 0.75,
  },
  securityText: {
    ...typography.caption,
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    flexShrink: 1,
    lineHeight: 16,
  },
});
