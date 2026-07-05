import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { DtrController } from './dtr/dtr.controller';
import { DtrService } from './dtr/dtr.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { WorkforceContextService } from './workforce-context.service';

@Module({
  controllers: [
    AttendanceController,
    LeaveController,
    EmployeesController,
    DtrController,
  ],
  providers: [
    WorkforceContextService,
    AttendanceService,
    LeaveService,
    EmployeesService,
    DtrService,
  ],
})
export class WorkforceModule {}
