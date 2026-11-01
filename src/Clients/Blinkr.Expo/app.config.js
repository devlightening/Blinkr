// Static config, permission texts and plugin options live in app.json; this file only adds the ids and the
// values that come from the environment.
module.exports = ({ config }) => ({
  ...config,
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
    'expo-localization',
    'expo-status-bar',
    'expo-video',
  ],
});
