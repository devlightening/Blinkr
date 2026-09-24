import { registerRootComponent } from 'expo';

// Must stay the first app import: picks the light/dark theme before any screen builds its styles (plan-devam B3).
import './src/themeBoot';
// Then the language, so every label is built in it (plan-devam G1).
import './src/i18n/boot';
import './src/analyticsBoot';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
