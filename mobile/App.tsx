import { StatusBar } from "expo-status-bar";
import {
  DarkTheme,
  NavigationContainer,
  type Theme,
} from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import AuthNavigator from "./src/navigation/AuthNavigator";
import DriverNavigator from "./src/navigation/DriverNavigator";
import StudentNavigator from "./src/navigation/StudentNavigator";
import { ActivityIndicator, View } from "react-native";
import { colors } from "./src/theme";
// Register background GPS task at startup (TaskManager.defineTask)
import "./src/utils/backgroundLocation";

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <AuthNavigator />;
  }

  // Admin is web-only — never mount an AdminNavigator here
  if (user.role === "driver") {
    return <DriverNavigator />;
  }

  if (user.role === "student") {
    return <StudentNavigator />;
  }

  return <AuthNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
