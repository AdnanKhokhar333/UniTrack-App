import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import QRCode from "qrcode";
import { colors } from "../theme";

type Props = {
  value: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
};

/**
 * Pure View-matrix QR — no react-native-svg (avoids Expo TransformError on opacity).
 */
export default function QrCodeView({
  value,
  size = 220,
  backgroundColor = colors.qrBg,
  foregroundColor = colors.qrFg,
}: Props) {
  const modules = useMemo(() => {
    if (!value) return null;
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
      const n = qr.modules.size;
      const rows: boolean[][] = [];
      for (let y = 0; y < n; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < n; x++) {
          row.push(!!qr.modules.get(x, y));
        }
        rows.push(row);
      }
      return rows;
    } catch {
      return null;
    }
  }, [value]);

  if (!modules || modules.length === 0) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, backgroundColor },
        ]}
      />
    );
  }

  const n = modules.length;
  const cell = size / n;

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor,
      }}
    >
      {modules.map((row, y) => (
        <View key={`r-${y}`} style={{ flexDirection: "row", height: cell }}>
          {row.map((dark, x) => (
            <View
              key={`c-${y}-${x}`}
              style={{
                width: cell,
                height: cell,
                backgroundColor: dark ? foregroundColor : backgroundColor,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
