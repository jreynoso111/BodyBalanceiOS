import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  methods: LocalAuthentication.AuthenticationType[];
  securityLevel: LocalAuthentication.SecurityLevel;
  label: string;
}

function resolveBiometricLabel(methods: LocalAuthentication.AuthenticationType[]): string {
  if (methods.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'face recognition';
  }

  if (methods.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint';
  }

  if (methods.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'iris';
  }

  return 'biometrics';
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const methods = hasHardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
  const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
  const securityLevel = hasHardware
    ? await LocalAuthentication.getEnrolledLevelAsync()
    : LocalAuthentication.SecurityLevel.NONE;

  return {
    hasHardware,
    methods,
    isEnrolled,
    securityLevel,
    label: resolveBiometricLabel(methods),
  };
}

export async function promptBiometricVerification(label?: string): Promise<LocalAuthentication.LocalAuthenticationResult> {
  const displayLabel = label || 'biometrics';
  const promptMessage =
    displayLabel === 'Face ID' || displayLabel === 'Touch ID'
      ? `Verify with ${displayLabel}`
      : 'Verify with biometrics';

  return LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  });
}
