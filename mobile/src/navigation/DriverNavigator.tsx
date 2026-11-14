import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DriverHomeScreen from "../screens/driver/DriverHomeScreen";
import { colors } from "../theme";

export type DriverStackParamList = {
  DriverHome: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

/** Driver Mode — Start/End Trip, GPS upload, stop-wise attendance. */
export default function DriverNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bgElev,
        },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ title: "Driver Ops" }}
      />
    </Stack.Navigator>
  );
}
