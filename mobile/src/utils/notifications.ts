import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken } from "../api/users";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request permission and register Expo push token with the API (best-effort). */
export async function setupPushNotifications(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    // Expo Go may not need projectId; EAS builds often do
    const extra = Constants.expoConfig?.extra as
      | { eas?: { projectId?: string } }
      | undefined;
    const projectId =
      extra?.eas?.projectId ||
      (Constants as { easConfig?: { projectId?: string } }).easConfig
        ?.projectId;

    let token: string;
    try {
      const tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      token = tokenResponse.data;
    } catch {
      // Still allow local notifications without a push token
      return null;
    }
    try {
      await registerPushToken(token, Platform.OS);
    } catch {
      // Token still usable for local notifications if API fails
    }
    return token;
  } catch {
    return null;
  }
}

export async function notifyBusApproaching(opts: {
  stopName: string;
  distanceKm: number;
  etaMin: number;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Bus approaching",
      body: `${opts.stopName}: ~${opts.distanceKm.toFixed(1)} km / ~${Math.ceil(
        opts.etaMin
      )} min away`,
      sound: true,
    },
    trigger: null,
  });
}
