import { View } from 'react-native';
export const useVideoPlayer = () => null;
export const VideoView = View;
export const NotificationFeedbackType = { Success: 1, Error: 2 };
export const notificationAsync = async () => {};
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
