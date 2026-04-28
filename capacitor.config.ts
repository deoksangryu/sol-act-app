import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solact.academy',
  appName: 'SOL-ACT',
  webDir: 'dist',
  server: {
    url: 'https://sol-manager.com',
    cleartext: true,
  },
};

export default config;
