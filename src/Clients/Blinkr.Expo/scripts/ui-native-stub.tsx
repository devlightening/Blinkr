import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { View } from 'react-native';
export const useVideoPlayer = () => null;
export const VideoView = View;
export const NotificationFeedbackType = { Success: 1, Error: 2 };
export const notificationAsync = async () => {};
export const impactAsync = async () => {};
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export default { expoConfig: { version: '1.0.0' } };
export const selectionAsync = async () => {};
export const requestCameraPermissionsAsync = async () => ({ status: 'denied' });
export const requestMediaLibraryPermissionsAsync = requestCameraPermissionsAsync;
export const launchCameraAsync = async () => ({ canceled: true, assets: [] });
export const launchImageLibraryAsync = launchCameraAsync;
export const getItemAsync = async (key: string) => localStorage.getItem(key);
export const setItemAsync = async (key: string, value: string) => localStorage.setItem(key, value);
export const deleteItemAsync = async (key: string) => localStorage.removeItem(key);

// expo-location: ?needperm = not asked yet, ?blockedperm = refused for good, ?nofix = no position available.
const locFlag = (name: string) => typeof location !== 'undefined' && location.search.includes(name);
let permissionGranted = false;
export const Accuracy = { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5 };
export const getForegroundPermissionsAsync = async () => {
  if (locFlag('blockedperm')) return { granted: false, canAskAgain: false, status: 'denied' };
  if (locFlag('needperm') && !permissionGranted) return { granted: false, canAskAgain: true, status: 'undetermined' };
  return { granted: true, canAskAgain: true, status: 'granted' };
};
export const requestForegroundPermissionsAsync = async () => { permissionGranted = true; return { granted: true, canAskAgain: true, status: 'granted' }; };
export const getLastKnownPositionAsync = async () => (locFlag('nofix') ? null : { coords: { latitude: 37.0742, longitude: 36.2478, accuracy: 20 } });
export const getCurrentPositionAsync = async () => {
  if (locFlag('nofix')) return new Promise<never>(() => {});
  return { coords: { latitude: 37.0742, longitude: 36.2478, accuracy: 20 } };
};

// expo-camera / react-native-view-shot: ?nocamperm = camera permission not granted yet.
const camFlag = (name: string) => typeof location !== 'undefined' && location.search.includes(name);
const PHOTO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b7a63"/><stop offset="1" stop-color="#2c3f4f"/></linearGradient></defs><rect width="900" height="1200" fill="url(#g)"/><circle cx="640" cy="360" r="170" fill="#e9c46a"/><rect x="0" y="820" width="900" height="380" fill="#1d2b25"/></svg>');
let stopRecording: (() => void) | null = null;
export const CameraView = forwardRef<unknown, { style?: unknown; onCameraReady?: () => void }>(function CameraView(props, ref) {
  useImperativeHandle(ref, () => ({
    takePictureAsync: async () => ({ uri: PHOTO, width: 900, height: 1200 }),
    recordAsync: () => new Promise((resolve) => { stopRecording = () => resolve({ uri: 'file:///clip.mp4' }); }),
    stopRecording: () => stopRecording?.(),
  }));
  useEffect(() => { props.onCameraReady?.(); }, []);
  return <View accessibilityLabel="Kamera önizlemesi" style={[{ backgroundColor: '#33473d' }, props.style as never]} />;
});
export const useCameraPermissions = () => [{ granted: !camFlag('nocamperm'), canAskAgain: true, status: 'granted' }, async () => ({ granted: true })] as const;
export const useMicrophonePermissions = () => [{ granted: true, canAskAgain: true, status: 'granted' }, async () => ({ granted: true })] as const;
export const captureRef = async () => PHOTO + '#rendered';

// expo-location geocoding: `?geocode` makes "kadirli" style address queries resolve to a coordinate.
export const geocodeAsync = async (address: string) => (locFlag('geocode') && address.trim().length >= 3 ? [{ latitude: 37.37, longitude: 36.1 }] : []);

// expo-screen-capture: the viewer asks the OS to block screenshots while a snap is on screen.
export const preventScreenCaptureAsync = async () => {};
export const allowScreenCaptureAsync = async () => {};
