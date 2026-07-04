export function buildAcceptInviteUrl(
  invitationId: string,
  webUrl = process.env.WEB_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
): string {
  return `${webUrl}/accept-invite?id=${encodeURIComponent(invitationId)}`;
}
