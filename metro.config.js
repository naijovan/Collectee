// Metro config — the only reason this file exists is the `.glb` line below.
//
// Expo's default `assetExts` has no 3D formats, so `require('…/foo.glb')`
// resolves as a source file, Metro tries to parse binary glTF as JavaScript and
// the bundle fails. Registering the extension makes it a bundled asset like a
// PNG, which is what `expo-asset` needs to hand a URI to `GLTFLoader`.
//
// Keep this list minimal. Every extension added here is one Metro stops
// treating as code.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;
