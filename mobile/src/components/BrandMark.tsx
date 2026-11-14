import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import IndigoFill from "./IndigoFill";
import { colors, typography } from "../theme";

type BrandMarkProps = {
  /** Show the UniTrack wordmark next to the badge (default true) */
  showWordmark?: boolean;
};

/** Shared UniTrack badge + optional wordmark — matches admin BrandMark. */
export default function BrandMark({ showWordmark = true }: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <IndigoFill style={styles.badge}>
        <Ionicons name="bus" size={18} color={colors.onFilled} />
      </IndigoFill>
      {showWordmark ? <Text style={styles.wordmark}>UniTrack</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  wordmark: {
    ...typography.brand,
    fontSize: 22,
    color: colors.brandWordmark,
    letterSpacing: -0.4,
  },
});
