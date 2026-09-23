import { registerRootComponent } from 'expo';

// Must stay the first app import: picks the light/dark theme before any screen builds its styles (plan-devam B3).
import './src/themeBoot';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
