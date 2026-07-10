import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import {
  markInvitationUsed,
  validateAdminInvitation,
} from '../admin-invitations/admin-invitations.store';
import {
  resolvePlatformRole,
  validateOrgInvitationForSignup,
} from '../org-invitations/org-invitations.store';
import { createBranchAssignment } from '../organizations/branch-assignments.store';
import { createEmployeeProfile } from '../workforce/employees/employee-profiles.store';
import { prepareEmployeeLeaveBalances } from '../workforce/leave/leave-balance.context';
import { todayDateString } from '../workforce/employees/leave-days.util';
import { buildAcceptInviteUrl } from '../org-invitations/invite-url';
import { sendOrgInvitationEmail } from '../email/email.client';
import { getMongoClient, getMongoDb } from '../database/mongo';
import {
  orgAc,
  orgInvitationSchema,
  orgRoles,
} from './org-roles';

const SUPER_ADMIN_ROLE = 'super_admin';

function resolveAdvancedAuthOptions() {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

  let crossOrigin = false;
  try {
    crossOrigin = new URL(apiUrl).origin !== new URL(webUrl).origin;
  } catch {
    crossOrigin = false;
  }

  if (!crossOrigin) {
    return {};
  }

  return {
    useSecureCookies: true,
    defaultCookieAttributes: {
      sameSite: 'none' as const,
      secure: true,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any = null;

export async function createAuth() {
  if (authInstance) {
    return authInstance;
  }

  const db = await getMongoDb();
  const client = await getMongoClient();
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

  authInstance = betterAuth({
    baseURL: process.env.API_URL ?? 'http://localhost:3001',
    basePath: '/api/auth',
    secret:
      process.env.AUTH_SECRET ??
      'dev-secret-change-in-production-min-32-chars',
    advanced: resolveAdvancedAuthOptions(),
    trustedOrigins: (process.env.TRUSTED_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: mongodbAdapter(db, { client }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        platformRole: {
          type: 'string',
          required: false,
          defaultValue: 'org_admin',
          input: false,
        },
        themeMode: {
          type: 'string',
          required: false,
          defaultValue: 'dark',
          input: true,
        },
      },
    },
    experimental: {
      joins: true,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            const bootstrapSecret =
              typeof ctx?.body?.platformBootstrapSecret === 'string'
                ? ctx.body.platformBootstrapSecret
                : undefined;
            const expectedBootstrap = process.env.PLATFORM_BOOTSTRAP_SECRET;

            if (
              bootstrapSecret &&
              expectedBootstrap &&
              bootstrapSecret === expectedBootstrap
            ) {
              return {
                data: {
                  ...user,
                  platformRole: SUPER_ADMIN_ROLE,
                },
              };
            }

            const orgInvitationId =
              typeof ctx?.body?.orgInvitationId === 'string'
                ? ctx.body.orgInvitationId
                : undefined;

            if (!orgInvitationId) {
              return { data: user };
            }

            const invitation = await validateOrgInvitationForSignup(
              orgInvitationId,
              user.email,
            );

            return {
              data: {
                ...user,
                platformRole: resolvePlatformRole(invitation.role),
              },
            };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') {
          return;
        }

        const adminToken =
          typeof ctx.body?.invitationToken === 'string'
            ? ctx.body.invitationToken
            : undefined;
        const orgInvitationId =
          typeof ctx.body?.orgInvitationId === 'string'
            ? ctx.body.orgInvitationId
            : undefined;
        const bootstrapSecret =
          typeof ctx.body?.platformBootstrapSecret === 'string'
            ? ctx.body.platformBootstrapSecret
            : undefined;
        const expectedBootstrap = process.env.PLATFORM_BOOTSTRAP_SECRET;
        const email =
          typeof ctx.body?.email === 'string' ? ctx.body.email : undefined;

        if (
          bootstrapSecret &&
          expectedBootstrap &&
          bootstrapSecret === expectedBootstrap
        ) {
          return;
        }

        if (adminToken) {
          try {
            await validateAdminInvitation(adminToken, email);
          } catch (error) {
            throw APIError.from('BAD_REQUEST', {
              code: 'INVALID_INVITATION',
              message:
                error instanceof Error
                  ? error.message
                  : 'Invalid invitation token.',
            });
          }
          return;
        }

        if (orgInvitationId) {
          try {
            await validateOrgInvitationForSignup(orgInvitationId, email);
          } catch (error) {
            throw APIError.from('BAD_REQUEST', {
              code: 'INVALID_ORG_INVITATION',
              message:
                error instanceof Error
                  ? error.message
                  : 'Invalid organization invitation.',
            });
          }
          return;
        }

        throw APIError.from('BAD_REQUEST', {
          code: 'INVITATION_REQUIRED',
          message: 'An invitation is required to create an account.',
        });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') {
          return;
        }

        const adminToken =
          typeof ctx.body?.invitationToken === 'string'
            ? ctx.body.invitationToken
            : undefined;
        const returned = ctx.context.returned;

        if (
          !adminToken ||
          !returned ||
          typeof returned !== 'object' ||
          !('user' in returned) ||
          !returned.user ||
          typeof returned.user !== 'object' ||
          !('id' in returned.user) ||
          typeof returned.user.id !== 'string'
        ) {
          return;
        }

        await markInvitationUsed(adminToken, returned.user.id);
      }),
    },
    plugins: [
      organization({
        ac: orgAc,
        roles: orgRoles,
        allowUserToCreateOrganization: true,
        creatorRole: 'owner',
        organizationLimit: 1,
        sendInvitationEmail: async (data) => {
          const inviteUrl = buildAcceptInviteUrl(data.id, webUrl);
          await sendOrgInvitationEmail({
            email: data.email,
            role: data.role,
            inviteUrl,
            organizationName:
              typeof data.organization?.name === 'string'
                ? data.organization.name
                : undefined,
          });
        },
        organizationHooks: {
          afterAcceptInvitation: async ({ invitation, member, user }) => {
            const branchId =
              typeof invitation.branchId === 'string'
                ? invitation.branchId
                : undefined;

            if (!branchId) {
              return;
            }

            await createBranchAssignment({
              organizationId: String(invitation.organizationId),
              userId: user.id,
              memberId: member.id,
              branchId,
              role: member.role,
            });

            if (member.role === 'employee') {
              const today = todayDateString();
              await createEmployeeProfile({
                organizationId: String(invitation.organizationId),
                userId: user.id,
                memberId: member.id,
                branchId,
                employmentType: 'probation',
                hireDate: today,
                contractStartDate: today,
              });

              await prepareEmployeeLeaveBalances({
                organizationId: String(invitation.organizationId),
                userId: user.id,
                memberId: member.id,
                branchId,
              });
            }
          },
        },
        schema: {
          organization: {
            additionalFields: {
              industry: { type: 'string', required: false },
              timezone: { type: 'string', required: false },
              address: { type: 'string', required: false },
              city: { type: 'string', required: false },
              phone: { type: 'string', required: false },
              description: { type: 'string', required: false },
              website: { type: 'string', required: false },
              primaryColor: { type: 'string', required: false },
              secondaryColor: { type: 'string', required: false },
              accentColor: { type: 'string', required: false },
              logoFileName: { type: 'string', required: false },
              onboardingCompleted: {
                type: 'boolean',
                required: false,
                defaultValue: false,
              },
            },
          },
          ...orgInvitationSchema,
        },
      }),
    ],
  });

  return authInstance;
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
