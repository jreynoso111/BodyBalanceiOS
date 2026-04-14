const baseConfig = require('./app.json');

function readEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

module.exports = ({ config }) => {
  const expo = baseConfig.expo ?? {};
  const bundleIdentifier = readEnv('APP_BUNDLE_IDENTIFIER', expo.ios?.bundleIdentifier);
  const androidPackage = readEnv('APP_ANDROID_PACKAGE', expo.android?.package || bundleIdentifier);
  const scheme = readEnv('APP_SCHEME', 'buddybalance');
  const appName = readEnv('APP_NAME', 'Buddy Balance');
  const appSlug = readEnv('APP_SLUG', 'buddy-balance');
  const appEnv = readEnv('APP_ENV', 'development');
  const easBuildPlatform = readEnv('EAS_BUILD_PLATFORM', '');
  const androidPremiumProductId = readEnv(
    'EXPO_PUBLIC_ANDROID_PREMIUM_SUBSCRIPTION_ID',
    readEnv('EXPO_PUBLIC_ANDROID_PREMIUM_PRODUCT_ID', '')
  );
  const androidPremiumMonthlyProductId = readEnv('EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY_SUBSCRIPTION_ID', '');
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

  const requiresAndroidBillingProductId =
    Boolean(androidPackage) && appEnv === 'production' && (!easBuildPlatform || easBuildPlatform === 'android');

  if (requiresAndroidBillingProductId && !androidPremiumProductId && !androidPremiumMonthlyProductId) {
    throw new Error(
      'Missing EXPO_PUBLIC_ANDROID_PREMIUM_SUBSCRIPTION_ID or EXPO_PUBLIC_ANDROID_PREMIUM_MONTHLY_SUBSCRIPTION_ID for Android production config. ' +
        'Set at least one before running the Android production build and make sure the same subscription ID exists in Google Play Console.'
    );
  }

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
