import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DriverHomeScreen from "../screens/driver/DriverHomeScreen";

export type DriverStackParamList = {
  DriverHome: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

/** Driver Mode — Start/End Trip, GPS upload, stop-wise attendance. */
export default function DriverNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
      }}
    >
      <Stack.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ title: "Driver" }}
      />
    </Stack.Navigator>
  );
}
