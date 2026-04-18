import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  methods: LocalAuthentication.AuthenticationType[];
  securityLevel: LocalAuthentication.SecurityLevel;
  label: string;
}

function getMethodDisplayName(method: LocalAuthentication.AuthenticationType): string | null {
  if (method === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
    return Platform.OS === 'ios' ? 'Face ID' : 'face recognition';
  }

  if (method === LocalAuthentication.AuthenticationType.FINGERPRINT) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint';
  }

  if (method === LocalAuthentication.AuthenticationType.IRIS) {
    return 'iris scan';
  }

  return null;
}

function resolveBiometricLabel(methods: LocalAuthentication.AuthenticationType[]): string {
  const supportedLabels = methods
    .map((method) => getMethodDisplayName(method))
    .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

  if (supportedLabels.length === 0) {
    return 'biometrics';
  }

  if (supportedLabels.length === 1) {
    return supportedLabels[0];
  }

  if (supportedLabels.length === 2) {
    return `${supportedLabels[0]} or ${supportedLabels[1]}`;
  }

  return `${supportedLabels.slice(0, -1).join(', ')}, or ${supportedLabels[supportedLabels.length - 1]}`;
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
  const promptMessage = displayLabel === 'biometrics'
    ? 'Verify with biometrics'
    : `Verify with ${displayLabel}`;

  return LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  });
}
