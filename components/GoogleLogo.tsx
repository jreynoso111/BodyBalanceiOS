import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface GoogleLogoProps {
  size?: number;
}

const googleLogo = require('../assets/brand/google-g-logo.png');

export function GoogleLogo({ size = 18 }: GoogleLogoProps) {
  return (
    <Image
      source={googleLogo}
      style={[styles.logo, { width: size, height: size }]}
      resizeMode="contain"
      accessibilityLabel="Google logo"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: 'transparent',
  },
});
