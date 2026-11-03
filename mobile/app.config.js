/**
 * Expo config — reads EXPO_PUBLIC_* from .env when you run `npx expo start`.
 */
export default {
  expo: {
    name: "UniTrack",
    slug: "unitrack",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#0f172a",
    },
    web: {
      bundler: "metro",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "edu.unitrack.app",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "UniTrack needs your location while a trip is active so students can see the bus on the map.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "UniTrack continues sharing bus location when the app is minimized during an active trip.",
        UIBackgroundModes: ["location", "fetch"],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#0f172a",
      },
      package: "edu.unitrack.app",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        },
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
      ],
    },
    plugins: [
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow UniTrack to use your location while driving so the bus can be tracked.",
          locationAlwaysAndWhenInUsePermission:
            "Allow UniTrack to keep sharing bus location when the screen is locked during a trip.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        "expo-notifications",
        {
          sounds: [],
        },
      ],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.8:5000",
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      eas: {
        projectId: "1b0083ed-8e8e-49f1-8572-f38ed8a85cc9",
      },
    },
  },
};
