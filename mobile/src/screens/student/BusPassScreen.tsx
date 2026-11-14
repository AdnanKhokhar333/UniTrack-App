import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { getMyBusPass } from "../../api/pass";
import QrCodeView from "../../components/QrCodeView";
import type { BusPass } from "../../types";
import { toTitleCase } from "../../utils/format";
import { colors, radius } from "../../theme";

function apiError(e: unknown, fallback: string): string {
  return (
    (e as { response?: { data?: { error?: string } }; message?: string })
      ?.response?.data?.error ||
    (e as { message?: string })?.message ||
    fallback
  );
}

export default function BusPassScreen() {
  const isFocused = useIsFocused();
  const [pass, setPass] = useState<BusPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPass(await getMyBusPass());
    } catch (e) {
      setPass(null);
      setError(apiError(e, "Could not load bus pass"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) load();
  }, [isFocused, load]);

  const qrPayload = useMemo(() => {
    if (!pass) return "";
    return JSON.stringify({
      sn: pass.student_number,
      name: pass.full_name,
      date: pass.valid_date,
      token: pass.token,
      uni: pass.university,
      route: pass.route_name,
    });
  }, [pass]);

  const displayName = useMemo(() => {
    if (!pass?.full_name) return "";
    return toTitleCase(pass.full_name);
  }, [pass?.full_name]);

  const universityLabel =
    pass?.university?.trim() || "University Smart Transport";

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.ctaIndigoMid} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Digital Bus Pass</Text>
      <Text style={styles.muted}>
        Present this QR pass to the transport conductor upon boarding.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pass ? (
        <View style={styles.card}>
          <View style={styles.qrFrame}>
            <QrCodeView value={qrPayload} size={220} />
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.rollPill}>
            <Text style={styles.rollPillText}>{pass.student_number}</Text>
          </View>
          <Text style={styles.meta}>{universityLabel}</Text>
          {pass.route_name ? (
            <Text style={styles.meta}>{pass.route_name}</Text>
          ) : null}
          {pass.stop_name ? (
            <Text style={styles.meta}>Stop: {pass.stop_name}</Text>
          ) : null}
          <Text style={styles.valid}>Valid: {pass.valid_date}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.refreshBtn, loading && styles.disabled]}
        onPress={load}
        disabled={loading}
      >
        <View style={styles.btnContent}>
          <Ionicons name="refresh" size={18} color={colors.onFilled} />
          <Text style={styles.refreshText}>Refresh pass</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 48 },
  center: { justifyContent: "center", alignItems: "center" },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  muted: { color: colors.muted, marginBottom: 16, lineHeight: 20 },
  error: { color: colors.danger, marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: "center",
  },
  qrFrame: {
    backgroundColor: colors.qrBg,
    padding: 18,
    borderRadius: 14,
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  rollPill: {
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: colors.violetSoft,
    borderWidth: 1,
    borderColor: colors.ctaIndigoMid,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rollPillText: {
    color: colors.ctaIndigoMid,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  meta: { color: colors.muted, textAlign: "center", marginTop: 2 },
  valid: {
    color: colors.success,
    marginTop: 12,
    fontWeight: "600",
  },
  refreshBtn: {
    marginTop: 20,
    backgroundColor: colors.ctaIndigo,
    borderRadius: radius,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ctaIndigoMid,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshText: { color: colors.onFilled, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.55 },
});
