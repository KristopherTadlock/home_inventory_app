const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const repoRoot = path.resolve(__dirname, '..');

/**
 * core-bridge is a Yarn workspace in packages/, and its dependencies are hoisted to the
 * repo root, so Metro has to watch and resolve outside this directory.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [
    path.join(repoRoot, 'packages/core-bridge'),
    path.join(repoRoot, 'node_modules'),
  ],
  resolver: {
    nodeModulesPaths: [
      path.join(__dirname, 'node_modules'),
      path.join(repoRoot, 'node_modules'),
    ],
    blockList: [/packages\/core-bridge\/android\/(build|\.cxx|src\/main\/jniLibs)\/.*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
