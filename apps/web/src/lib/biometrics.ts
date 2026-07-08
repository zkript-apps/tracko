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

  return startAuthentication({ optionsJSON: options });
}
