import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { WorkforceContextService } from './workforce-context.service';

@Module({
  controllers: [AttendanceController, LeaveController],
  providers: [WorkforceContextService, AttendanceService, LeaveService],
})
export class WorkforceModule {}
