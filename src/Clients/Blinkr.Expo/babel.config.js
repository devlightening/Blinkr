module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Per-icon lucide imports (bundle size); the reanimated plugin stays last.
    plugins: ['./babel-plugin-lucide-icons', 'react-native-reanimated/plugin'],
  };
};
