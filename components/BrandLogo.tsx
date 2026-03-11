import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { BRAND_COLORS, BRAND_NAME, BRAND_TAGLINE } from '@/constants/Brand';
import { useAppTheme } from '@/hooks/useAppTheme';

type BrandLogoSize = 'sm' | 'md' | 'lg' | number;

interface BrandLogoProps {
  size?: BrandLogoSize;
  showWordmark?: boolean;
  showTagline?: boolean;
  centered?: boolean;
}

function resolveSize(size: BrandLogoSize): number {
  if (typeof size === 'number') return size;
  if (size === 'sm') return 36;
  if (size === 'lg') return 74;
  return 54;
}

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  centered = false,
}: BrandLogoProps) {
  const markSize = resolveSize(size);
  const { theme } = useAppTheme();

  return (
    <View style={[styles.root, centered && styles.centered]}>
      <View
        style={[
          styles.markWrap,
          {
            width: markSize,
            height: markSize,
            borderRadius: markSize * 0.28,
          },
        ]}
      >
        <Image
          source={require('@/assets/images/logo.png')}
          style={{
            width: markSize * 1.2,
            height: markSize * 1.2,
            resizeMode: 'contain',
            borderRadius: markSize * 0.28,
          }}
        />
        <View
          style={[
            styles.checkBadge,
            {
              width: markSize * 0.34,
              height: markSize * 0.34,
              borderRadius: markSize * 0.17,
              right: -markSize * 0.08,
              bottom: -markSize * 0.08,
            },
          ]}
        >
          <Text
            style={[
              styles.checkText,
              {
                fontSize: markSize * 0.19,
              },
            ]}
          >
            ✓
          </Text>
        </View>
      </View>

      {showWordmark ? (
        <View style={[styles.wordmarkBlock, centered && styles.wordmarkCentered]}>
          <Text style={[styles.wordmark, { color: theme.brandWordmark }]}>{BRAND_NAME}</Text>
          {showTagline ? <Text style={[styles.tagline, { color: theme.brandTagline }]}>{BRAND_TAGLINE}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  centered: {
    justifyContent: 'center',
    flexDirection: 'column',
  },
  markWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    shadowColor: BRAND_COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  glowInner: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  checkBadge: {
    position: 'absolute',
    backgroundColor: BRAND_COLORS.success,
    borderWidth: 2,
    borderColor: BRAND_COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markMonogram: {
    color: BRAND_COLORS.white,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  checkText: {
    color: BRAND_COLORS.white,
    fontWeight: '900',
    textAlign: 'center',
  },
  wordmarkBlock: {
    marginLeft: 14,
    backgroundColor: 'transparent',
  },
  wordmarkCentered: {
    alignItems: 'center',
    marginLeft: 0,
    marginTop: 14,
  },
  wordmark: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tagline: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
});
