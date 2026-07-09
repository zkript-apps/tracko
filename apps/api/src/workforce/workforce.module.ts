import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AnnouncementsService } from './announcements/announcements.service';
import { AttendanceBiometricsService } from './attendance/attendance-biometrics.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { DtrController } from './dtr/dtr.controller';
import { DtrService } from './dtr/dtr.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { HolidaysController } from './holidays/holidays.controller';
import { HolidaysService } from './holidays/holidays.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { PayrollController } from './payroll/payroll.controller';
import { PayrollService } from './payroll/payroll.service';
import { WorkforceContextService } from './workforce-context.service';

@Module({
  imports: [BillingModule],
  controllers: [
    AnnouncementsController,
    AttendanceController,
    LeaveController,
    EmployeesController,
    DtrController,
    PayrollController,
    HolidaysController,
  ],
  providers: [
    WorkforceContextService,
    AnnouncementsService,
    AttendanceBiometricsService,
    AttendanceService,
    LeaveService,
    EmployeesService,
    DtrService,
    PayrollService,
    HolidaysService,
  ],
})
export class WorkforceModule {}
