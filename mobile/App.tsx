import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import AuthNavigator from "./src/navigation/AuthNavigator";
import DriverNavigator from "./src/navigation/DriverNavigator";
import StudentNavigator from "./src/navigation/StudentNavigator";
import { ActivityIndicator, View } from "react-native";
// Register background GPS task at startup (TaskManager.defineTask)
import "./src/utils/backgroundLocation";

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#38bdf8" />
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
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
