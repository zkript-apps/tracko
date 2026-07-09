import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../database/mongo';
import { WorkforceContextService } from '../workforce-context.service';
import {
  createBiometricCredential,
  findBiometricCredentialByCredentialId,
  listBiometricCredentialsForUser,
  serializeBiometricStatus,
  updateBiometricCredentialCounter,
} from './biometric-credentials.store';
import {
  consumeLatestWebAuthnChallenge,
  createWebAuthnChallenge,
} from './webauthn-challenges.store';
import {
  getWebAuthnConfig,
  isAttendanceBiometricsRequired,
} from './webauthn.config';

type UserDoc = { _id: string | ObjectId; name?: string; email?: string };

function userIdFilter(userId: string): { _id: string | ObjectId } | { $or: Array<{ _id: string | ObjectId }> } {
  if (ObjectId.isValid(userId) && String(new ObjectId(userId)) === userId) {
    return { $or: [{ _id: userId }, { _id: new ObjectId(userId) }] };
  }

  return { _id: userId };
}

/**
 * Attendance clock-in is same-device. Passing `hybrid` alongside `internal`
 * makes Windows often open a broken phone/QR passkey flow instead of Hello.
 */
function transportsForLocalAuth(
  transports?: string[],
): AuthenticatorTransportFuture[] | undefined {
  if (!transports?.length) {
    return undefined;
  }

  if (transports.includes('internal')) {
    return ['internal'];
  }

  return transports as AuthenticatorTransportFuture[];
}

@Injectable()
export class AttendanceBiometricsService {
  constructor(private readonly workforce: WorkforceContextService) {}

  private async loadUser(userId: string): Promise<UserDoc> {
    const db = await getMongoDb();
    const user = await db
      .collection<UserDoc>('user')
      .findOne(userIdFilter(userId));

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async getStatus(request: Request) {
    const context = await this.workforce.requireEmployee(request);
    const credentials = await listBiometricCredentialsForUser(
      context.organizationId,
      context.userId,
    );

    return {
      ...serializeBiometricStatus(credentials),
      biometricsRequired: isAttendanceBiometricsRequired(),
    };
  }

  async getRegistrationOptions(request: Request) {
    const context = await this.workforce.requireEmployee(request);
    const user = await this.loadUser(context.userId);
    const credentials = await listBiometricCredentialsForUser(
      context.organizationId,
      context.userId,
    );
    const { origin, rpID, rpName } = getWebAuthnConfig();

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email ?? context.userId,
      userDisplayName: user.name ?? 'Employee',
      userID: Buffer.from(context.userId, 'utf8'),
      attestationType: 'none',
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: transportsForLocalAuth(credential.transports),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });

    await createWebAuthnChallenge({
      userId: context.userId,
      challenge: options.challenge,
      type: 'registration',
    });

    return options;
  }

  async verifyRegistration(
    request: Request,
    response: RegistrationResponseJSON,
  ) {
    const context = await this.workforce.requireEmployee(request);
    const { origin, rpID } = getWebAuthnConfig();
    const challengeRecord = await consumeLatestWebAuthnChallenge({
      userId: context.userId,
      type: 'registration',
    });

    if (!challengeRecord) {
      throw new BadRequestException('Registration challenge expired or invalid.');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Biometric registration could not be verified.');
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    const existing = await findBiometricCredentialByCredentialId(credential.id);
    if (existing) {
      throw new BadRequestException('This biometric credential is already enrolled.');
    }

    await createBiometricCredential({
      organizationId: context.organizationId,
      userId: context.userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });

    return {
      enrolled: true,
      credentialId: credential.id,
    };
  }

  async getAuthenticationOptions(request: Request) {
    const context = await this.workforce.requireEmployee(request);
    const credentials = await listBiometricCredentialsForUser(
      context.organizationId,
      context.userId,
    );

    if (credentials.length === 0) {
      throw new BadRequestException(
        'Set up biometric clock-in before clocking in or out.',
      );
    }

    const { rpID } = getWebAuthnConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: transportsForLocalAuth(credential.transports),
      })),
    });

    await createWebAuthnChallenge({
      userId: context.userId,
      challenge: options.challenge,
      type: 'authentication',
    });

    return options;
  }

  async verifyAuthenticationForClock(
    request: Request,
    response: AuthenticationResponseJSON,
  ): Promise<{ credentialId: string }> {
    const context = await this.workforce.requireEmployee(request);
    const storedCredential = await findBiometricCredentialByCredentialId(
      response.id,
    );

    if (
      !storedCredential ||
      storedCredential.userId !== context.userId ||
      storedCredential.organizationId !== context.organizationId
    ) {
      throw new BadRequestException('Biometric credential not recognized.');
    }

    const challengeRecord = await consumeLatestWebAuthnChallenge({
      userId: context.userId,
      type: 'authentication',
    });

    if (!challengeRecord) {
      throw new BadRequestException('Biometric challenge expired or invalid.');
    }

    const { origin, rpID } = getWebAuthnConfig();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: storedCredential.credentialId,
        publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
        counter: storedCredential.counter,
        transports: storedCredential.transports as AuthenticatorTransportFuture[] | undefined,
      },
    });

    if (!verification.verified) {
      throw new BadRequestException('Biometric verification failed.');
    }

    const { newCounter } = verification.authenticationInfo;
    await updateBiometricCredentialCounter({
      credentialId: storedCredential.credentialId,
      counter: newCounter,
    });

    return { credentialId: storedCredential.credentialId };
  }
}
