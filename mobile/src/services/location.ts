import * as ExpoLocation from "expo-location";

let locationSubscription: ExpoLocation.LocationSubscription | null = null;

export async function getCurrentLocation() {
  const { status } = await ExpoLocation.getForegroundPermissionsAsync();

  if (status === "denied") {
    throw new Error(
      "Location permission was denied. Please enable it in Settings > Privacy > Location Services for this app."
    );
  }

  if (status !== "granted") {
    const { status: newStatus } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (newStatus !== "granted") {
      throw new Error("Location permission denied");
    }
  }

  const last = await ExpoLocation.getLastKnownPositionAsync();
  if (last) {
    return {
      lat: last.coords.latitude,
      lng: last.coords.longitude,
    };
  }

  const loc = await ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.Low,
  });

  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
  };
}

export async function startTracking(
  onLocation: (coords: { lat: number; lng: number }) => void,
  intervalMs = 30000
) {
  await requestLocationPermission();
  stopTracking();
  locationSubscription = await ExpoLocation.watchPositionAsync(
    {
      accuracy: ExpoLocation.Accuracy.High,
      distanceInterval: 50,
      timeInterval: intervalMs,
    },
    (loc) => {
      onLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    }
  );
}

export function stopTracking() {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}

async function requestLocationPermission() {
  const { status } = await ExpoLocation.getForegroundPermissionsAsync();
  if (status === "denied") {
    throw new Error(
      "Location permission was denied. Please enable it in Settings."
    );
  }
  if (status !== "granted") {
    const { status: newStatus } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (newStatus !== "granted") {
      throw new Error("Location permission denied");
    }
  }
}
