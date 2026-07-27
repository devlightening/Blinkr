import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthScreen } from './src/components/AuthScreen';
import { MapScreen } from './src/components/MapScreen';
import type { AuthResponse } from './src/types';

export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {auth
        ? <MapScreen auth={auth} onLogout={() => setAuth(null)} />
        : <AuthScreen onAuthenticated={setAuth} />}
    </SafeAreaProvider>
  );
}
