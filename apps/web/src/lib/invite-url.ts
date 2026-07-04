export function buildAcceptInviteUrl(
  invitationId: string,
  webUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3000',
): string {
  return `${webUrl}/accept-invite?id=${encodeURIComponent(invitationId)}`;
}
