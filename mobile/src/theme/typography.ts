/**
 * Type scale aligned with admin-web Plus Jakarta Sans usage.
 * Native uses system font; sizes/weights stay consistent app-wide.
 */
export const typography = {
  brand: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
  title: { fontSize: 22, fontWeight: "700" as const },
  subtitle: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  label: { fontSize: 12, fontWeight: "600" as const },
  button: { fontSize: 15, fontWeight: "700" as const },
} as const;
