/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */
import React from 'react';
import { Text as DefaultText, View as DefaultView, ViewStyle } from 'react-native';
import { AnimatedBackground } from './AnimatedBackground';

import { useColorScheme } from './useColorScheme';

import Colors from '@/constants/Colors';
import { translateText } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

function translateChildren(node: React.ReactNode, language: 'en' | 'es' | 'fr' | 'it'): React.ReactNode {
  if (typeof node === 'string') return translateText(node, language);
  if (Array.isArray(node)) {
    return React.Children.toArray(
      node.map((child) => translateChildren(child, language))
    );
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node) && node.props?.children) {
    return React.cloneElement(node, {
      ...node.props,
      children: translateChildren(node.props.children, language),
    });
  }
  return node;
}

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme();
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, children, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const language = useAuthStore((state) => state.language);
  const translatedChildren = translateChildren(children, language);

  return (
    <DefaultText style={[{ color }, style]} {...otherProps}>
      {translatedChildren}
    </DefaultText>
  );
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}

export function Card(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'card');
  const borderColor = useThemeColor({ light: lightColor, dark: darkColor }, 'border');

  return (
    <DefaultView
      style={[
        {
          backgroundColor,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 2,
        },
        style
      ]}
      {...otherProps}
    />
  );
}

import { Edge, SafeAreaView } from 'react-native-safe-area-context';

type ScreenProps = ViewProps & {
  safeAreaEdges?: Edge[];
};

export function Screen(props: ScreenProps) {
  const { style, children, lightColor, darkColor, safeAreaEdges, ...otherProps } = props;
  return (
    <AnimatedBackground style={{ flex: 1 }}>
      <SafeAreaView edges={safeAreaEdges} style={[{ flex: 1 }, style]} {...otherProps}>
        <DefaultView style={[{ flex: 1, backgroundColor: 'transparent' }]}>
          {children}
        </DefaultView>
      </SafeAreaView>
    </AnimatedBackground>
  );
}
