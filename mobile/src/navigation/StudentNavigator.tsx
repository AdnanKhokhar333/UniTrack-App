import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StudentHomeScreen from "../screens/student/StudentHomeScreen";

export type StudentStackParamList = {
  StudentHome: undefined;
};

const Stack = createNativeStackNavigator<StudentStackParamList>();

/** Student Mode — attendance, route/stops, basic live bus map. */
export default function StudentNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
      }}
    >
      <Stack.Screen
        name="StudentHome"
        component={StudentHomeScreen}
        options={{ title: "Student" }}
      />
    </Stack.Navigator>
  );
}
