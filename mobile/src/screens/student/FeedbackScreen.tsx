import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { submitComplaint } from "../../api/complaints";
import { submitRating } from "../../api/ratings";
import { listActiveTrips } from "../../api/trips";
import { colors, radius } from "../../theme";

const STAR_GOLD = "#FBBF24";
const STAR_MUTED = "rgba(148, 163, 184, 0.45)";

function apiError(e: unknown, fallback: string): string {
  return (
    (e as { response?: { data?: { error?: string } }; message?: string })
      ?.response?.data?.error ||
    (e as { message?: string })?.message ||
    fallback
  );
}

export default function FeedbackScreen() {
  const { studentProfile } = useAuth();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busyRating, setBusyRating] = useState(false);
  const [busyComplaint, setBusyComplaint] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const starOptions = useMemo(() => [1, 2, 3, 4, 5], []);

  async function resolveTripIds(): Promise<{
    trip_id?: number;
    driver_id?: number;
  }> {
    try {
      const routeId = studentProfile?.active_route_id;
      const trips = await listActiveTrips();
      const active =
        (routeId != null
          ? trips.find((t) => t.route_id === routeId)
          : undefined) ?? trips[0];
      if (active) {
        return { trip_id: active.id, driver_id: active.driver_id };
      }
    } catch {
      // Backend will fall back to latest completed/active on route
    }
    return {};
  }

  async function onRate() {
    setBusyRating(true);
    setError(null);
    setInfo(null);
    try {
      const ids = await resolveTripIds();
      await submitRating({
        stars,
        comment: comment.trim() || undefined,
        ...ids,
      });
      setComment("");
      setInfo("Thanks — rating submitted.");
    } catch (e) {
      setError(apiError(e, "Could not submit rating"));
    } finally {
      setBusyRating(false);
    }
  }

  async function onComplaint() {
    if (!subject.trim() || !body.trim()) {
      setError("Please add a subject and details for your complaint.");
      return;
    }
    setBusyComplaint(true);
    setError(null);
    setInfo(null);
    try {
      const ids = await resolveTripIds();
      await submitComplaint({
        subject: subject.trim(),
        body: body.trim(),
        ...ids,
      });
      setSubject("");
      setBody("");
      setInfo("Complaint sent to admin.");
    } catch (e) {
      setError(apiError(e, "Could not submit complaint"));
    } finally {
      setBusyComplaint(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Rate & Report</Text>
      <Text style={styles.muted}>
        Rate your driver after a trip, or send a short complaint to admin.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="star" size={18} color={STAR_GOLD} />
          <Text style={styles.sectionTitle}>Rate driver</Text>
        </View>
        <View style={styles.starRow}>
          {starOptions.map((n) => {
            const selected = n <= stars;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
                hitSlop={6}
                style={styles.starBtn}
                onPress={() => setStars(n)}
              >
                <Ionicons
                  name={selected ? "star" : "star-outline"}
                  size={32}
                  color={selected ? STAR_GOLD : STAR_MUTED}
                  style={selected ? styles.starGlow : undefined}
                />
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Optional comment"
          placeholderTextColor={colors.muted}
          value={comment}
          onChangeText={setComment}
          maxLength={500}
        />
        <Pressable
          style={[styles.primaryBtn, busyRating && styles.disabled]}
          onPress={onRate}
          disabled={busyRating}
        >
          {busyRating ? (
            <ActivityIndicator color={colors.onFilled} />
          ) : (
            <Text style={styles.primaryText}>Submit Rating</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={colors.ctaIndigoMid}
          />
          <Text style={styles.sectionTitle}>Complaint</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Subject"
          placeholderTextColor={colors.muted}
          value={subject}
          onChangeText={setSubject}
          maxLength={200}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What happened?"
          placeholderTextColor={colors.muted}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <Pressable
          style={[styles.primaryBtn, busyComplaint && styles.disabled]}
          onPress={onComplaint}
          disabled={busyComplaint}
        >
          {busyComplaint ? (
            <ActivityIndicator color={colors.onFilled} />
          ) : (
            <Text style={styles.primaryText}>Send Complaint</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 48 },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  muted: { color: colors.muted, marginBottom: 16, lineHeight: 20 },
  error: { color: colors.danger, marginBottom: 12 },
  info: { color: colors.success, marginBottom: 12 },
  card: {
    backgroundColor: colors.cardSurface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  starBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  starGlow: {
    textShadowColor: "rgba(251, 191, 36, 0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  textArea: { minHeight: 100 },
  primaryBtn: {
    backgroundColor: colors.ctaIndigo,
    borderRadius: radius,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ctaIndigoMid,
    marginTop: 4,
  },
  primaryText: { color: colors.onFilled, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.55 },
});
