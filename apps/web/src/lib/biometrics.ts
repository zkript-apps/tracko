import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { apiFetch } from './api';

export type BiometricStatus = {
  enrolled: boolean;
  credentialCount: number;
  lastUsedAt: string | null;
  biometricsRequired: boolean;
};

export async function getBiometricSupport(): Promise<{
  supported: boolean;
  platformAvailable: boolean;
}> {
  const supported = browserSupportsWebAuthn();
  const platformAvailable = supported
    ? await platformAuthenticatorIsAvailable()
    : false;

  return { supported, platformAvailable };
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  return apiFetch('/attendance/me/biometric/status');
}

export async function registerBiometricCredential(): Promise<{
  enrolled: boolean;
  credentialId: string;
}> {
  const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>(
    '/attendance/me/biometric/register/options',
    { method: 'POST', body: JSON.stringify({}) },
  );
  const attestation = await startRegistration({ optionsJSON: options });

  return apiFetch('/attendance/me/biometric/register/verify', {
    method: 'POST',
    body: JSON.stringify({ response: attestation }),
  });
}

export async function authenticateWithBiometric(): Promise<AuthenticationResponseJSON> {
  const options = await apiFetch<PublicKeyCredentialRequestOptionsJSON>(
    '/attendance/me/biometric/authenticate/options',
    { method: 'POST', body: JSON.stringify({}) },
  );

  try {
    return await startAuthentication({ optionsJSON: options });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : '';

    if (
      message.includes('not allowed') ||
      message.includes('abort') ||
      message.includes('cancel')
    ) {
      throw new Error('Biometric verification was canceled.');
    }

    throw new Error(
      'Unable to verify this device passkey. Try clock-in again, or remove the passkey in Windows Settings > Accounts > Passkeys and set it up again here.',
    );
  }
}
