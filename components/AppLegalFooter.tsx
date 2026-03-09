import React from 'react';
import { StyleProp, StyleSheet, TextStyle } from 'react-native';

import { Text } from '@/components/Themed';

const COPYRIGHT_TEXT = '\u00a9 2026 Buddy Balance, The Anomaly Solutions';

export function AppLegalFooter({ style }: { style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.text, style]}>{COPYRIGHT_TEXT}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    textAlign: 'center',
    color: '#94A3B8',
  },
});
