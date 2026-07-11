// Backend base URL. Override with EXPO_PUBLIC_API_URL in mobile/.env.
// (The literal `process.env.EXPO_PUBLIC_*` form is required so Expo's babel
// transform can inline the value at build time.)
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL || 'https://sol-act-server.ngrok.app';
