import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { apiUrl } from './api';

export const authClient = createAuthClient({
  baseURL: apiUrl,
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession, getSession, organization } =
  authClient;

type EmailSignUpInput = Parameters<typeof signUp.email>[0];

export async function signUpWithInvitation(input: {
  name: string;
  email: string;
  password: string;
  invitationToken: string;
}) {
  return signUp.email(
    {
      name: input.name,
      email: input.email,
      password: input.password,
      invitationToken: input.invitationToken,
    } as EmailSignUpInput & { invitationToken: string },
  );
}

export async function signUpWithOrgInvitation(input: {
  name: string;
  email: string;
  password: string;
  orgInvitationId: string;
}) {
  return signUp.email(
    {
      name: input.name,
      email: input.email,
      password: input.password,
      orgInvitationId: input.orgInvitationId,
    } as EmailSignUpInput & { orgInvitationId: string },
  );
}

export async function signUpSuperAdmin(input: {
  name: string;
  email: string;
  password: string;
  platformBootstrapSecret: string;
}) {
  return signUp.email(
    {
      name: input.name,
      email: input.email,
      password: input.password,
      platformBootstrapSecret: input.platformBootstrapSecret,
    } as EmailSignUpInput & { platformBootstrapSecret: string },
  );
}
