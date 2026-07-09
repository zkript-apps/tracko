import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { AttendanceBiometricsService } from './attendance-biometrics.service';
import { AttendanceService } from './attendance.service';

class ClockDto {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  biometricResponse?: AuthenticationResponseJSON;
}

class LocationDto {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

class RegisterBiometricDto {
  response!: RegistrationResponseJSON;
}

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly biometrics: AttendanceBiometricsService,
  ) {}

  @Get('me/status')
  myStatus(@Req() request: Request) {
    return this.attendance.getMyStatus(request);
  }

  @Get('me/biometric/status')
  biometricStatus(@Req() request: Request) {
    return this.biometrics.getStatus(request);
  }

  @Post('me/biometric/register/options')
  biometricRegisterOptions(@Req() request: Request) {
    return this.biometrics.getRegistrationOptions(request);
  }

  @Post('me/biometric/register/verify')
  biometricRegisterVerify(
    @Req() request: Request,
    @Body() body: RegisterBiometricDto,
  ) {
    return this.biometrics.verifyRegistration(request, body.response);
  }

  @Post('me/biometric/authenticate/options')
  biometricAuthenticateOptions(@Req() request: Request) {
    return this.biometrics.getAuthenticationOptions(request);
  }

  @Post('me/clock-in')
  clockIn(@Req() request: Request, @Body() body: ClockDto) {
    return this.attendance.clockIn(request, body);
  }

  @Post('me/clock-out')
  clockOut(@Req() request: Request, @Body() body: ClockDto) {
    return this.attendance.clockOut(request, body);
  }

  @Post('me/location')
  updateMyLocation(@Req() request: Request, @Body() body: LocationDto) {
    return this.attendance.updateMyLocation(request, body);
  }

  @Get('live-locations')
  liveLocations(
    @Req() request: Request,
    @Query('branchId') branchId?: string,
  ) {
    return this.attendance.getLiveLocations(request, branchId);
  }

  @Get('branch/overview')
  branchOverview(@Req() request: Request, @Query('branchId') branchId?: string) {
    return this.attendance.getBranchOverview(request, branchId);
  }
}
