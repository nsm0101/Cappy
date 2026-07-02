module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
          },
        },
      ],
      // Worklets plugin (hosts Reanimated 4's transform) must be last
      'react-native-worklets/plugin',
    ],
  };
};
