const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = []; // Do not watch any extra folders
config.resolver.blockList = [
  /node_modules\/.*\/node_modules/, // Ignore nested node_modules
];

module.exports = config;
