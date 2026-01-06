import monitorCallbackAsync from "@calcom/core/sentryWrapper";
import { handleWebhookTrigger } from "@calcom/features/bookings/lib/handleWebhookTrigger";
import type { GetSubscriberOptions } from "@calcom/features/webhooks/lib/getWebhooks";
import type { EventPayloadType } from "@calcom/features/webhooks/lib/sendPayload";
import { EMAIL_FROM_NAME } from "@calcom/lib/constants";
import { WebhookTriggerEvents } from "@calcom/prisma/enums";
import type { CalendarEvent, Person } from "@calcom/types/Calendar";

import { renderEmail } from "../";
import generateIcsFile, { GenerateIcsRole } from "../lib/generateIcsFile";
import OrganizerScheduledEmail from "./organizer-scheduled-email";
import type { Reassigned } from "./organizer-scheduled-email";

export default class OrganizerReassignedEmail extends OrganizerScheduledEmail {
  protected async getNodeMailerPayload(): Promise<Record<string, unknown>> {
    const toAddresses = [this.teamMember?.email || this.calEvent.organizer.email];

    return {
      icalEvent: generateIcsFile({
        calEvent: this.calEvent,
        status: "CANCELLED",
        role: GenerateIcsRole.ORGANIZER,
      }),
      from: `${EMAIL_FROM_NAME} <${this.getMailerOptions().from}>`,
      to: toAddresses.join(","),
      subject: `${this.t("event_reassigned_subject", {
        title: this.calEvent.title,
        date: this.getFormattedDate(),
      })}`,
      html: await this.getHtml(this.calEvent, this.calEvent.organizer, this.reassigned),
      text: this.getTextBody("event_request_reassigned"),
    };
  }

  async getHtml(calEvent: CalendarEvent, attendee: Person, reassigned: Reassigned | undefined) {
    const subscriberOptions: GetSubscriberOptions = {
      teamId: calEvent.team?.id,
      triggerEvent: WebhookTriggerEvents.BOOKING_PAYMENT_INITIATED,
    };

    const webhookData: EventPayloadType = {
      ...calEvent,
      bookingId: calEvent.bookingId,
      eventTypeId: calEvent.eventTypeId,
      rescheduledBy: reassigned?.email,
    };

    const eventTrigger = WebhookTriggerEvents.BOOKING_PAYMENT_INITIATED;

    await monitorCallbackAsync(handleWebhookTrigger, {
      subscriberOptions,
      eventTrigger,
      webhookData,
    });

    return await renderEmail("OrganizerReassignedEmail", {
      calEvent,
      attendee,
      reassigned,
    });
  }
}
