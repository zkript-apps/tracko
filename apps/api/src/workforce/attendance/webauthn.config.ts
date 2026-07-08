export function getWebAuthnConfig() {
  const origin =
    process.env.WEBAUTHN_ORIGIN ??
    process.env.TRUSTED_ORIGINS?.split(',')[0]?.trim() ??
    'http://localhost:3000';
  const rpID =
    process.env.WEBAUTHN_RP_ID?.trim() || new URL(origin).hostname;
  const rpName = process.env.WEBAUTHN_RP_NAME?.trim() || 'Tracko';

  return { origin, rpID, rpName };
}

export function isAttendanceBiometricsRequired(): boolean {
  return process.env.ATTENDANCE_BIOMETRICS_REQUIRED !== 'false';
}
