import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BusPassScreen from "../screens/student/BusPassScreen";
import FeedbackScreen from "../screens/student/FeedbackScreen";
import StudentHomeScreen from "../screens/student/StudentHomeScreen";
import { colors } from "../theme";

export type StudentStackParamList = {
  StudentHome: undefined;
  BusPass: undefined;
  Feedback: undefined;
};

const Stack = createNativeStackNavigator<StudentStackParamList>();

/** Student Mode — attendance, route/stops, live bus map, pass, feedback. */
export default function StudentNavigator() {
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
        name="StudentHome"
        component={StudentHomeScreen}
        options={{ title: "Student Ops" }}
      />
      <Stack.Screen
        name="BusPass"
        component={BusPassScreen}
        options={{ title: "Bus Pass" }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ title: "Feedback" }}
      />
    </Stack.Navigator>
  );
}
