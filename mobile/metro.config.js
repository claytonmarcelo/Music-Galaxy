// Configuração do Metro Bundler para o projeto Music Galaxy.
// O monorepo tem node_modules na raiz (musicgalaxy/node_modules).
// Configuramos explicitamente para:
//   1. Não varrer o diretório backend/ (evita sobrecarga de watchers)
//   2. Resolver módulos do node_modules raiz
//   3. Não confundir o entry point com prefix mobile/

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Raiz do monorepo
const raizMonorepo = path.resolve(__dirname, '..');

const config = getDefaultConfig(__dirname);

// Resolve módulos primeiro localmente, depois na raiz do monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(raizMonorepo, 'node_modules'),
];

// Bloqueia diretórios desnecessários do watcher — evita sobrecarga
// e o erro ENOENT no watcher do react-native-screens/android
config.resolver.blockList = [
  // Ignora o backend Node.js — não é código React Native
  new RegExp(`${path.resolve(raizMonorepo, 'backend').replace(/\\/g, '\\\\')}.*`),
  // Ignora o diretório Android nativo do react-native-screens na raiz
  /node_modules\/react-native-screens\/android\/.*/,
  /node_modules\/react-native\/android\/.*/,
  /node_modules\/react-native\/Libraries\/.*\/android\/.*/,
];

module.exports = config;
