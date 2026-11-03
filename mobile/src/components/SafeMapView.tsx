import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MapView, { type Region } from "react-native-maps";
import {
  getMapProvider,
  MAP_LOAD_FAILED_MESSAGE,
  useMapReadyGate,
} from "../utils/googleMaps";

type MapViewProps = ComponentProps<typeof MapView>;
type LatLng = { latitude: number; longitude: number };

type SafeMapViewProps = Omit<MapViewProps, "loadingEnabled" | "provider"> & {
  wrapStyle?: StyleProp<ViewStyle>;
  /** Applied via animateToRegion on onMapReady (Android often ignores initialRegion alone). */
  focusRegion?: Region;
  /** Prefer fitting markers so the map is not an empty ocean / wrong default. */
  fitCoordinates?: LatLng[];
  /** Re-apply region/fit when this changes (e.g. routeId-tripId). */
  focusKey?: string | number | null;
  /**
   * Called when the user starts/stops interacting with the map.
   * Parent ScrollView should set scrollEnabled={!active} so pinch-pan
   * is not stolen by the outer scroll on Android.
   */
  onMapGestureActive?: (active: boolean) => void;
  children?: ReactNode;
};

/**
 * ScrollView-safe MapView (fixed-height wrap, collapsable={false}).
 * Expo Go: omit provider (see getMapProvider). Grey Google logo without road
 * tiles can still happen in Expo Go — use `npx expo run:android` + API key for
 * reliable Google tiles.
 */
const SafeMapView = forwardRef<MapView, SafeMapViewProps>(function SafeMapView(
  {
    wrapStyle,
    style,
    focusRegion,
    fitCoordinates,
    focusKey,
    onMapReady,
    onMapGestureActive,
    scrollEnabled = true,
    zoomEnabled = true,
    pitchEnabled = false,
    rotateEnabled = false,
    children,
    ...rest
  },
  ref
) {
  const mapRef = useRef<MapView | null>(null);
  const appliedFocus = useRef<string | null>(null);
  const { mapReady, showLoadFailed, onMapReady: markReady } = useMapReadyGate(4000);
  const provider = getMapProvider();
  const providerProps = useMemo(
    () => (provider != null ? { provider } : {}),
    [provider]
  );

  useImperativeHandle(ref, () => mapRef.current as MapView);

  const setGestureActive = (active: boolean) => {
    onMapGestureActive?.(active);
  };

  const applyFocus = () => {
    const map = mapRef.current;
    if (!map) return;
    const coords = (fitCoordinates ?? []).filter(
      (c) =>
        Number.isFinite(c.latitude) &&
        Number.isFinite(c.longitude) &&
        !(c.latitude === 0 && c.longitude === 0)
    );
    if (coords.length >= 2) {
      map.fitToCoordinates(coords, {
        edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
        animated: true,
      });
      return;
    }
    if (coords.length === 1) {
      map.animateToRegion(
        {
          latitude: coords[0].latitude,
          longitude: coords[0].longitude,
          latitudeDelta: focusRegion?.latitudeDelta ?? 0.04,
          longitudeDelta: focusRegion?.longitudeDelta ?? 0.04,
        },
        350
      );
      return;
    }
    if (focusRegion) {
      map.animateToRegion(focusRegion, 350);
    }
  };

  useEffect(() => {
    if (!mapReady) return;
    const key = String(focusKey ?? "default");
    if (appliedFocus.current === key) return;
    appliedFocus.current = key;
    // Defer so Android MapView has layout after ScrollView mount.
    const t = setTimeout(applyFocus, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyFocus uses latest props
  }, [mapReady, focusKey]);

  return (
    <View
      style={[styles.wrap, wrapStyle]}
      collapsable={false}
      onStartShouldSetResponderCapture={() => {
        // Claim touches so parent ScrollView does not steal pinch/pan on Android.
        setGestureActive(true);
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        setGestureActive(true);
        return false;
      }}
      onResponderTerminationRequest={() => false}
      onTouchEnd={() => setGestureActive(false)}
      onTouchCancel={() => setGestureActive(false)}
    >
      <MapView
        ref={mapRef}
        style={[styles.mapFill, style]}
        {...providerProps}
        {...rest}
        initialRegion={focusRegion ?? rest.initialRegion}
        scrollEnabled={scrollEnabled}
        zoomEnabled={zoomEnabled}
        zoomTapEnabled={zoomEnabled}
        zoomControlEnabled={Platform.OS === "android" && zoomEnabled}
        pitchEnabled={pitchEnabled}
        rotateEnabled={rotateEnabled}
        loadingEnabled={false}
        onTouchStart={() => setGestureActive(true)}
        onTouchEnd={() => setGestureActive(false)}
        onMapReady={() => {
          markReady();
          // Force region after ready — initialRegion alone often leaves Expo Go Android blank.
          setTimeout(applyFocus, 50);
          onMapReady?.();
        }}
      >
        {children}
      </MapView>
      {!mapReady && !showLoadFailed ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#38bdf8" />
        </View>
      ) : null}
      {showLoadFailed ? (
        <View style={styles.failOverlay} pointerEvents="none">
          <Text style={styles.failText}>{MAP_LOAD_FAILED_MESSAGE}</Text>
        </View>
      ) : null}
    </View>
  );
});

SafeMapView.displayName = "SafeMapView";

export default SafeMapView;

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#1e293b",
    borderRadius: 12,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(30,41,59,0.35)",
  },
  failOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.75)",
    padding: 16,
  },
  failText: {
    color: "#fde68a",
    textAlign: "center",
    lineHeight: 20,
  },
});
