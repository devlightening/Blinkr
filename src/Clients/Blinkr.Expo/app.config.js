module.exports = ({ config }) => ({
  ...config,
  name: 'Blinkr',
  slug: 'blinkr-expo',
  android: {
    ...config.android,
    package: 'com.blinkr.mobile',
    permissions: [
      ...(config.android?.permissions ?? []),
      'CAMERA',
      'RECORD_AUDIO',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
    ],
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      },
    },
  },
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.blinkr.mobile',
    infoPlist: {
      ...config.ios?.infoPlist,
      NSCameraUsageDescription: 'Blinkr sinyaline fotoğraf veya video eklemek için kamera erişimi kullanılır.',
      NSMicrophoneUsageDescription: 'Blinkr video sinyali oluştururken ses kaydı için mikrofon erişimi kullanılır.',
      NSPhotoLibraryUsageDescription: 'Blinkr sinyaline medya eklemek için fotoğraf arşivine erişilir.',
    },
    config: {
      ...config.ios?.config,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
  },
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_BLINKR_API_URL || '',
  },
  plugins: [
    ...(config.plugins ?? []),
    'expo-secure-store',
    'expo-image-picker',
  ],
});
