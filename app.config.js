const baseConfig = require('./app.json');

function readEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

module.exports = ({ config }) => {
  const expo = baseConfig.expo ?? {};
  const bundleIdentifier = readEnv('APP_BUNDLE_IDENTIFIER', expo.ios?.bundleIdentifier);
  const androidPackage = readEnv('APP_ANDROID_PACKAGE', expo.android?.package || bundleIdentifier);
  const scheme = readEnv('APP_SCHEME', 'buddybalance-ios');
  const appName = readEnv('APP_NAME', 'Body Balance iOS');
  const appSlug = readEnv('APP_SLUG', 'buddy-balance-ios');
  const appEnv = readEnv('APP_ENV', 'development');
  const googleOAuthEnabled = String(process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH || '').toLowerCase() === 'true';
  const ios = expo.ios || bundleIdentifier
    ? {
        ...(expo.ios ?? {}),
        ...(bundleIdentifier ? { bundleIdentifier } : {}),
      }
    : undefined;
  const android = expo.android || androidPackage
    ? {
        ...(expo.android ?? {}),
        ...(androidPackage ? { package: androidPackage } : {}),
      }
    : undefined;

  return {
    ...config,
    ...expo,
    name: appName,
    slug: appSlug,
    scheme,
    ...(ios ? { ios } : {}),
    ...(android ? { android } : {}),
    extra: {
      ...(expo.extra ?? {}),
      appEnv,
      googleOAuthEnabled,
    },
  };
};
