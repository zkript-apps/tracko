import { Injectable } from '@nestjs/common';
import {
  sendAdminInvitationEmail,
  sendEmail,
  sendOrgInvitationEmail,
} from './email.client';

@Injectable()
export class EmailService {
  send = sendEmail;
  sendAdminInvitation = sendAdminInvitationEmail;
  sendOrgInvitation = sendOrgInvitationEmail;
}
