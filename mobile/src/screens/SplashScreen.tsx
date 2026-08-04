import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { color, text } from '../theme/tokens';

export function SplashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Text style={text.wordmark}>SOL-ACT</Text>
      <ActivityIndicator color={color.blue} />
    </View>
  );
}
