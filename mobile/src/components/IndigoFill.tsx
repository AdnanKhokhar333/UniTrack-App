import { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme";

type IndigoFillProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Softer mid indigo used for border / secondary wash */
  tone?: "solid" | "pill";
};

/**
 * Pure-RN stand-in for Indigo→Violet CTAs — no native gradient module.
 * Base #4F46E5, mid #6366F1 border/wash, light top highlight overlay.
 */
export default function IndigoFill({
  children,
  style,
  tone = "solid",
}: IndigoFillProps) {
  return (
    <View style={[styles.base, tone === "pill" ? styles.pill : null, style]}>
      <View style={styles.wash} pointerEvents="none" />
      <View style={styles.highlight} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.ctaIndigo,
    borderWidth: 1,
    borderColor: colors.ctaIndigoMid,
    overflow: "hidden",
    position: "relative",
  },
  pill: {
    borderRadius: 999,
  },
  /** Right/bottom mid-indigo wash to imply gradient depth */
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(99, 102, 241, 0.38)",
  },
  /** Soft top-left highlight */
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: "30%",
    height: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
});
