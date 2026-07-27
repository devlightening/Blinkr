module.exports = ({ config }) => ({
  ...config,
  name: 'Blinkr',
  slug: 'blinkr-expo',
  android: {
    ...config.android,
    package: 'com.blinkr.mobile',
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
});
