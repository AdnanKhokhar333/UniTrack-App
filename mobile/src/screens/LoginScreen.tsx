import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } }; message?: string })
          ?.response?.data?.error ||
        (e as { message?: string })?.message ||
        "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>UniTrack</Text>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.muted}>
        Driver or student accounts only. Admin uses the web dashboard.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={onLogin} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    color: "#38bdf8",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 6,
  },
  muted: {
    color: "#94a3b8",
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    color: "#f8fafc",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#38bdf8",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  error: {
    color: "#f87171",
    marginBottom: 8,
  },
});
