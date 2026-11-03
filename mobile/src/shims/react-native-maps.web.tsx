/**
 * Web stub for react-native-maps (native-only). Keeps Student/Driver screens
 * importing the same API without breaking Metro web resolution.
 */
import React from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const PROVIDER_DEFAULT = "default";
export const PROVIDER_GOOGLE = "google";

type LatLng = { latitude: number; longitude: number };

type MapViewProps = ViewProps & {
  provider?: string;
  initialRegion?: Region;
  region?: Region;
  scrollEnabled?: boolean;
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
  zoomEnabled?: boolean;
  moveOnMarkerPress?: boolean;
  loadingEnabled?: boolean;
  loadingIndicatorColor?: string;
  loadingBackgroundColor?: string;
  liteMode?: boolean;
  onMapReady?: () => void;
  children?: React.ReactNode;
};

type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  pinColor?: string;
  children?: React.ReactNode;
};

type MapViewHandle = View & {
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (
    coordinates: LatLng[],
    options?: {
      edgePadding?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
      animated?: boolean;
    }
  ) => void;
};

const MapView = React.forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { style, children, onMapReady, ...rest },
  ref
) {
  void rest;
  React.useImperativeHandle(
    ref,
    () =>
      ({
        animateToRegion: () => undefined,
        fitToCoordinates: () => undefined,
      }) as MapViewHandle
  );
  React.useEffect(() => {
    onMapReady?.();
  }, [onMapReady]);
  return (
    <View style={[styles.map, style]}>
      <Text style={styles.hint}>Map preview is available on iOS / Android</Text>
      {children}
    </View>
  );
});

export function Marker({ title, pinColor }: MarkerProps) {
  return (
    <View
      style={[
        styles.marker,
        { backgroundColor: pinColor || "#94a3b8" },
      ]}
      accessibilityLabel={title}
    />
  );
}

MapView.displayName = "MapView";

export default MapView;

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  hint: {
    color: "#94a3b8",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  marker: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.35,
  },
});
