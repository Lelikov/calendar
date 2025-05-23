"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import classNames from "classnames";
import { createEvent } from "ics";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { RRule } from "rrule";
import { z } from "zod";

import BookingPageTagManager from "@calcom/app-store/BookingPageTagManager";
import type { getEventLocationValue } from "@calcom/app-store/locations";
import { getSuccessPageLocationMessage, guessEventLocationType } from "@calcom/app-store/locations";
import { getEventTypeAppData } from "@calcom/app-store/utils";
import type { nameObjectSchema } from "@calcom/core/event";
import { getEventName } from "@calcom/core/event";
import type { ConfigType } from "@calcom/dayjs";
import dayjs from "@calcom/dayjs";
import { getOrgFullOrigin } from "@calcom/ee/organizations/lib/orgDomains";
import {
  useEmbedNonStylesConfig,
  useIsBackgroundTransparent,
  useIsEmbed,
} from "@calcom/embed-core/embed-iframe";
import { Price } from "@calcom/features/bookings/components/event-meta/Price";
import {
  SMS_REMINDER_NUMBER_FIELD,
  SystemField,
  TITLE_FIELD,
} from "@calcom/features/bookings/lib/SystemField";
import { APP_NAME, CURRENT_TIMEZONE } from "@calcom/lib/constants";
import {
  formatToLocalizedDate,
  formatToLocalizedTime,
  formatToLocalizedTimezone,
} from "@calcom/lib/date-fns";
import useGetBrandingColours from "@calcom/lib/getBrandColours";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import useTheme from "@calcom/lib/hooks/useTheme";
import isSmsCalEmail from "@calcom/lib/isSmsCalEmail";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import { getEveryFreqFor } from "@calcom/lib/recurringStrings";
import { getIs24hClockFromLocalStorage, isBrowserLocale24h } from "@calcom/lib/timeFormat";
import { localStorage } from "@calcom/lib/webstorage";
import { BookingStatus, SchedulingType } from "@calcom/prisma/enums";
import { bookingMetadataSchema, eventTypeMetaDataSchemaWithTypedApps } from "@calcom/prisma/zod-utils";
import { trpc } from "@calcom/trpc/react";
import {
  Avatar,
  Badge,
  Button,
  EmailInput,
  useCalcomTheme,
  TextArea,
  showToast,
  EmptyScreen,
  Icon,
  HeadSeo,
} from "@calcom/ui";
import CancelBooking from "@calcom/web/components/booking/CancelBooking";
import EventReservationSchema from "@calcom/web/components/schemas/EventReservationSchema";
import { timeZone } from "@calcom/web/lib/clock";

import type { PageProps } from "./bookings-single-view.getServerSideProps";

const stringToBoolean = z
  .string()
  .optional()
  .transform((val) => val === "true");

const querySchema = z.object({
  uid: z.string(),
  email: z.string().optional(),
  eventTypeSlug: z.string().optional(),
  cancel: stringToBoolean,
  allRemainingBookings: stringToBoolean,
  changes: stringToBoolean,
  reschedule: stringToBoolean,
  isSuccessBookingPage: stringToBoolean,
  formerTime: z.string().optional(),
  seatReferenceUid: z.string().optional(),
  rating: z.string().optional(),
  noShow: stringToBoolean,
});

const useBrandColors = ({
  brandColor,
  darkBrandColor,
}: {
  brandColor?: string | null;
  darkBrandColor?: string | null;
}) => {
  const brandTheme = useGetBrandingColours({
    lightVal: brandColor,
    darkVal: darkBrandColor,
  });
  useCalcomTheme(brandTheme);
};

export default function Success(props: PageProps) {
  const { t } = useLocale();
  const router = useRouter();
  const routerQuery = useRouterQuery();
  const pathname = usePathname();
  const searchParams = useCompatSearchParams();
  const { eventType, bookingInfo, requiresLoginToUpdate, orgSlug, rescheduledToUid } = props;

  const {
    allRemainingBookings,
    isSuccessBookingPage,
    cancel: isCancellationMode,
    formerTime,
    email,
    seatReferenceUid,
    noShow,
    rating,
  } = querySchema.parse(routerQuery);
  const attendeeTimeZone = bookingInfo?.attendees.find((attendee) => attendee.email === email)?.timeZone;

  const isFeedbackMode = !!(noShow || rating);
  const tz = props.tz ? props.tz : isSuccessBookingPage && attendeeTimeZone ? attendeeTimeZone : timeZone();

  const location = bookingInfo.location as ReturnType<typeof getEventLocationValue>;
  let rescheduleLocation: string | undefined;
  if (
    typeof bookingInfo.responses?.location === "object" &&
    "optionValue" in bookingInfo.responses.location
  ) {
    rescheduleLocation = bookingInfo.responses.location.optionValue;
  }

  const locationVideoCallUrl: string | undefined = bookingMetadataSchema.parse(
    bookingInfo?.metadata || {}
  )?.videoCallUrl;

  const status = bookingInfo?.status;
  const reschedule = bookingInfo.status === BookingStatus.ACCEPTED;
  const cancellationReason = bookingInfo.cancellationReason || bookingInfo.rejectionReason;

  const attendees = bookingInfo?.attendees;

  const isGmail = !!attendees.find((attendee) => attendee?.email?.includes("gmail.com"));

  const [is24h, setIs24h] = useState(
    props?.userTimeFormat ? props.userTimeFormat === 24 : isBrowserLocale24h()
  );
  const { data: session } = useSession();

  const [date, setDate] = useState(dayjs.utc(bookingInfo.startTime));

  const isBackgroundTransparent = useIsBackgroundTransparent();
  const isEmbed = useIsEmbed();
  const shouldAlignCentrallyInEmbed = useEmbedNonStylesConfig("align") !== "left";
  const shouldAlignCentrally = !isEmbed || shouldAlignCentrallyInEmbed;
  const [calculatedDuration, setCalculatedDuration] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState("");
  const parsedRating = rating ? parseInt(rating, 10) : 3;
  const currentUserEmail =
    searchParams?.get("rescheduledBy") ??
    searchParams?.get("cancelledBy") ??
    session?.user?.email ??
    undefined;

  const defaultRating = isNaN(parsedRating) ? 3 : parsedRating > 5 ? 5 : parsedRating < 1 ? 1 : parsedRating;
  const [rateValue, setRateValue] = useState<number>(defaultRating);
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);

  const mutation = trpc.viewer.public.submitRating.useMutation({
    onSuccess: async () => {
      setIsFeedbackSubmitted(true);
      showToast("Thank you, feedback submitted", "success");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const hostNoShowMutation = trpc.viewer.public.markHostAsNoShow.useMutation({
    onSuccess: async () => {
      showToast("Thank you, feedback submitted", "success");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  useEffect(() => {
    if (noShow) {
      hostNoShowMutation.mutate({ bookingUid: bookingInfo.uid, noShowHost: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendFeedback = async (rating: string, comment: string) => {
    mutation.mutate({ bookingUid: bookingInfo.uid, rating: rateValue, comment: comment });
  };

  function setIsCancellationMode(value: boolean) {
    const _searchParams = new URLSearchParams(searchParams?.toString() ?? undefined);

    if (value) {
      _searchParams.set("cancel", "true");
    } else {
      if (_searchParams.get("cancel")) {
        _searchParams.delete("cancel");
      }
    }

    router.replace(`${pathname}?${_searchParams.toString()}`);
  }

  let evtName = eventType.eventName;
  if (eventType.isDynamic && bookingInfo.responses?.title) {
    evtName = bookingInfo.responses.title as string;
  }
  const eventNameObject = {
    attendeeName: bookingInfo.responses.name as z.infer<typeof nameObjectSchema> | string,
    eventType: eventType.title,
    eventName: evtName,
    host: props.profile.name || "Nameless",
    location: location,
    bookingFields: bookingInfo.responses,
    eventDuration: eventType.length,
    t,
  };

  const giphyAppData = getEventTypeAppData(
    {
      ...eventType,
      metadata: eventTypeMetaDataSchemaWithTypedApps.parse(eventType.metadata),
    },
    "giphy"
  );
  const giphyImage = giphyAppData?.thankYouPage;
  const isRoundRobin = eventType.schedulingType === SchedulingType.ROUND_ROBIN;

  const eventName = getEventName(eventNameObject, true);
  // Confirmation can be needed in two cases as of now
  // - Event Type has require confirmation option enabled always
  // - EventType has conditionally enabled confirmation option based on how far the booking is scheduled.
  // - It's a paid event and payment is pending.
  const needsConfirmation = bookingInfo.status === BookingStatus.PENDING && eventType.requiresConfirmation;
  const userIsOwner = !!(session?.user?.id && eventType.owner?.id === session.user.id);
  const isLoggedIn = session?.user;
  const isCancelled =
    status === "CANCELLED" ||
    status === "REJECTED" ||
    (!!seatReferenceUid &&
      !bookingInfo.seatsReferences.some((reference) => reference.referenceUid === seatReferenceUid));

  // const telemetry = useTelemetry();
  /*  useEffect(() => {
    if (top !== window) {
      //page_view will be collected automatically by _middleware.ts
      telemetry.event(telemetryEventTypes.embedView, collectPageParameters("/booking"));
    }
  }, [telemetry]); */

  useEffect(() => {
    setDate(date.tz(localStorage.getItem("timeOption.preferredTimeZone") || CURRENT_TIMEZONE));
    setIs24h(props?.userTimeFormat ? props.userTimeFormat === 24 : !!getIs24hClockFromLocalStorage());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, needsConfirmation]);

  useEffect(() => {
    setCalculatedDuration(dayjs(bookingInfo.endTime).diff(dayjs(bookingInfo.startTime), "minutes"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function eventLink(): string {
    const optional: { location?: string } = {};
    if (locationVideoCallUrl) {
      optional["location"] = locationVideoCallUrl;
    }

    const event = createEvent({
      start: [
        date.toDate().getUTCFullYear(),
        (date.toDate().getUTCMonth() as number) + 1,
        date.toDate().getUTCDate(),
        date.toDate().getUTCHours(),
        date.toDate().getUTCMinutes(),
      ],
      startInputType: "utc",
      title: eventName,
      description: eventType.description ? eventType.description : undefined,
      /** formatted to required type of description ^ */
      duration: {
        minutes: calculatedDuration,
      },
      ...optional,
    });

    if (event.error) {
      throw event.error;
    }

    return encodeURIComponent(event.value ? event.value : false);
  }

  function getTitle(): string {
    const titleSuffix = props.recurringBookings ? "_recurring" : "";
    const titlePrefix = isRoundRobin ? "round_robin_" : "";
    if (isCancelled) {
      return "";
    }
    if (needsConfirmation) {
      if (props.profile.name !== null) {
        return t(`user_needs_to_confirm_or_reject_booking${titleSuffix}`, {
          user: props.profile.name,
        });
      }
      return t(`needs_to_be_confirmed_or_rejected${titleSuffix}`);
    }
    if (bookingInfo.user) {
      const isHost = bookingInfo.user.id === session?.user?.id;
      const isAttendee = bookingInfo.attendees.find((attendee) => attendee.email === session?.user?.email);
      const attendee = bookingInfo.attendees[0]?.name || bookingInfo.attendees[0]?.email || "Nameless";
      const host = bookingInfo.user.name || bookingInfo.user.email;
      if (isHost) {
        return t(`${titlePrefix}emailed_you_and_attendees${titleSuffix}`, {
          user: attendee,
        });
      }
      if (isAttendee) {
        return t(`${titlePrefix}emailed_you_and_attendees${titleSuffix}`, {
          user: host,
        });
      }
      return t(`${titlePrefix}emailed_host_and_attendee${titleSuffix}`, {
        host,
        attendee,
      });
    }
    return t(`emailed_you_and_attendees${titleSuffix}`);
  }

  // This is a weird case where the same route can be opened in booking flow as a success page or as a booking detail page from the app
  // As Booking Page it has to support configured theme, but as booking detail page it should not do any change. Let Shell.tsx handle it.
  useTheme(isSuccessBookingPage ? props.profile.theme : "system");
  useBrandColors({
    brandColor: props.profile.brandColor,
    darkBrandColor: props.profile.darkBrandColor,
  });
  const title = t(
    `booking_${needsConfirmation ? "submitted" : "confirmed"}${props.recurringBookings ? "_recurring" : ""}`
  );

  const locationToDisplay = getSuccessPageLocationMessage(
    locationVideoCallUrl ? locationVideoCallUrl : location,
    t,
    bookingInfo.status
  );

  const rescheduleLocationToDisplay = getSuccessPageLocationMessage(
    rescheduleLocation ?? "",
    t,
    bookingInfo.status
  );

  const providerName = guessEventLocationType(location)?.label;
  const rescheduleProviderName = guessEventLocationType(rescheduleLocation)?.label;
  const isBookingInPast = new Date(bookingInfo.endTime) < new Date();
  const isReschedulable = !isCancelled;

  const bookingCancelledEventProps = {
    booking: bookingInfo,
    organizer: {
      name: bookingInfo?.user?.name || "Nameless",
      email: bookingInfo?.userPrimaryEmail || bookingInfo?.user?.email || "Email-less",
      timeZone: bookingInfo?.user?.timeZone,
    },
    eventType,
  };

  const isRecurringBooking = props.recurringBookings;
  const needsConfirmationAndReschedulable = needsConfirmation && isReschedulable;
  const isNotAttendingSeatedEvent = isCancelled && seatReferenceUid;
  const isEventCancelled = isCancelled && !seatReferenceUid;
  const isPastBooking = isBookingInPast;
  const isRerouting = searchParams?.get("cal.rerouting") === "true";
  const isRescheduled = bookingInfo?.rescheduled;

  const successPageHeadline = (() => {
    if (needsConfirmationAndReschedulable) {
      return isRecurringBooking ? t("booking_submitted_recurring") : t("booking_submitted");
    }

    if (isRerouting) {
      return t("This meeting has been rerouted");
    }

    if (isNotAttendingSeatedEvent) {
      return t("no_longer_attending");
    }

    if (isRescheduled) {
      return t("your_event_has_been_rescheduled");
    }

    if (isEventCancelled) {
      return t("event_cancelled");
    }

    if (isPastBooking) {
      return t("event_is_in_the_past");
    }

    return isRecurringBooking ? t("meeting_is_scheduled_recurring") : t("meeting_is_scheduled");
  })();

  return (
    <div className={isEmbed ? "" : "h-screen"} data-testid="success-page">
      {!isEmbed && !isFeedbackMode && (
        <EventReservationSchema
          reservationId={bookingInfo.uid}
          eventName={eventName}
          startTime={bookingInfo.startTime}
          endTime={bookingInfo.endTime}
          organizer={bookingInfo.user}
          attendees={bookingInfo.attendees}
          location={locationToDisplay}
          description={bookingInfo.description}
          status={status}
        />
      )}
      {isLoggedIn && !isEmbed && !isFeedbackMode && (
        <div className="-mb-4 ml-4 mt-2">
          <Link
            href={allRemainingBookings ? "/bookings/recurring" : "/bookings/upcoming"}
            data-testid="back-to-bookings"
            className="hover:bg-subtle text-subtle hover:text-default mt-2 inline-flex px-1 py-2 text-sm transition dark:hover:bg-transparent">
            <Icon name="chevron-left" className="h-5 w-5 rtl:rotate-180" /> {t("back_to_bookings")}
          </Link>
        </div>
      )}
      <HeadSeo origin={getOrgFullOrigin(orgSlug)} title={title} description={title} />
      <BookingPageTagManager
        eventType={{ ...eventType, metadata: eventTypeMetaDataSchemaWithTypedApps.parse(eventType.metadata) }}
      />
      <main className={classNames(shouldAlignCentrally ? "mx-auto" : "", isEmbed ? "" : "max-w-3xl")}>
        <div className={classNames("overflow-y-auto", isEmbed ? "" : "z-50 ")}>
          <div
            className={classNames(
              shouldAlignCentrally ? "text-center" : "",
              "flex items-end justify-center px-4 pb-20 pt-4 sm:flex sm:p-0"
            )}>
            <div
              className={classNames(
                "main my-4 flex flex-col transition-opacity sm:my-0 ",
                isEmbed ? "" : " inset-0"
              )}
              aria-hidden="true">
              <div
                className={classNames(
                  "inline-block transform overflow-hidden rounded-lg border sm:my-8 sm:max-w-xl",
                  !isBackgroundTransparent && " bg-default dark:bg-muted border-booker border-booker-width",
                  "px-8 pb-4 pt-5 text-left align-bottom transition-all sm:w-full sm:py-8 sm:align-middle"
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-headline">
                {!isFeedbackMode && (
                  <>
                    <div
                      className={classNames(isRoundRobin && "min-w-32 min-h-24 relative mx-auto h-24 w-32")}>
                      {isRoundRobin && bookingInfo.user && (
                        <Avatar
                          className="mx-auto flex items-center justify-center"
                          alt={bookingInfo.user.name || bookingInfo.user.email}
                          size="xl"
                          imageSrc={`${bookingInfo.user.avatarUrl}`}
                        />
                      )}
                      {giphyImage && !needsConfirmation && isReschedulable && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={giphyImage} className="w-full rounded-lg" alt="Gif from Giphy" />
                      )}
                      <div
                        className={classNames(
                          "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                          isRoundRobin &&
                            "border-cal-bg dark:border-cal-bg-muted absolute bottom-0 right-0 z-10 h-12 w-12 border-8",
                          !giphyImage && isReschedulable && !needsConfirmation ? "bg-success" : "",
                          !giphyImage && isReschedulable && needsConfirmation ? "bg-subtle" : "",
                          isCancelled ? "bg-error" : ""
                        )}>
                        {!giphyImage && !needsConfirmation && isReschedulable && (
                          <Icon name="check" className="h-5 w-5 text-green-600 dark:text-green-400" />
                        )}
                        {needsConfirmation && isReschedulable && (
                          <Icon name="calendar" className="text-emphasis h-5 w-5" />
                        )}
                        {isCancelled && <Icon name="x" className="h-5 w-5 text-red-600 dark:text-red-200" />}
                      </div>
                    </div>
                    <div className="mb-8 mt-6 text-center last:mb-0">
                      <h3
                        className="text-emphasis text-2xl font-semibold leading-6"
                        data-testid={isCancelled ? "cancelled-headline" : ""}
                        id="modal-headline">
                        {successPageHeadline}
                      </h3>

                      <div className="mt-3">
                        <p className="text-default">{getTitle()}</p>
                      </div>
                      {props.paymentStatus &&
                        (bookingInfo.status === BookingStatus.CANCELLED ||
                          bookingInfo.status === BookingStatus.REJECTED) && (
                          <h4>
                            {!props.paymentStatus.success &&
                              !props.paymentStatus.refunded &&
                              t("booking_with_payment_cancelled")}
                            {props.paymentStatus.success &&
                              !props.paymentStatus.refunded &&
                              t("booking_with_payment_cancelled_already_paid")}
                            {props.paymentStatus.refunded && t("booking_with_payment_cancelled_refunded")}
                          </h4>
                        )}

                      <div className="border-subtle text-default mt-8 grid grid-cols-3 border-t pt-8 text-left rtl:text-right">
                        {(isCancelled || reschedule) && cancellationReason && (
                          <>
                            <div className="font-medium">
                              {isCancelled ? t("reason") : t("reschedule_reason")}
                            </div>
                            <div className="col-span-2 mb-6 last:mb-0">{cancellationReason}</div>
                          </>
                        )}
                        <div className="font-medium">{t("what")}</div>
                        <div className="col-span-2 mb-6 last:mb-0" data-testid="booking-title">
                          {isRoundRobin ? bookingInfo.title : eventName}
                        </div>
                        <div className="font-medium">{t("when")}</div>
                        <div className="col-span-2 mb-6 last:mb-0">
                          {reschedule && !!formerTime && (
                            <p className="line-through">
                              <RecurringBookings
                                eventType={eventType}
                                duration={calculatedDuration}
                                recurringBookings={props.recurringBookings}
                                allRemainingBookings={allRemainingBookings}
                                date={dayjs(formerTime)}
                                is24h={is24h}
                                isCancelled={isCancelled}
                                tz={tz}
                              />
                            </p>
                          )}
                          <RecurringBookings
                            eventType={eventType}
                            duration={calculatedDuration}
                            recurringBookings={props.recurringBookings}
                            allRemainingBookings={allRemainingBookings}
                            date={date}
                            is24h={is24h}
                            isCancelled={isCancelled}
                            tz={tz}
                          />
                        </div>
                        {(bookingInfo?.user || bookingInfo?.attendees) && (
                          <>
                            <div className="font-medium">{t("who")}</div>
                            <div className="col-span-2 last:mb-0">
                              {bookingInfo?.user && (
                                <div className="mb-3">
                                  <div>
                                    <span data-testid="booking-host-name" className="mr-2">
                                      {bookingInfo.user.name}
                                    </span>
                                    <Badge variant="blue">{t("Host")}</Badge>
                                  </div>
                                </div>
                              )}
                              {bookingInfo?.attendees.map((attendee) => (
                                <div key={attendee.name + attendee.email} className="mb-3 last:mb-0">
                                  {attendee.name && (
                                    <p data-testid={`attendee-name-${attendee.name}`}>{attendee.name}</p>
                                  )}
                                  {attendee.phoneNumber && (
                                    <p data-testid={`attendee-phone-${attendee.phoneNumber}`}>
                                      {attendee.phoneNumber}
                                    </p>
                                  )}
                                  {!isSmsCalEmail(attendee.email) && (
                                    <p data-testid={`attendee-email-${attendee.email}`}>{attendee.email}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {locationToDisplay && !isCancelled && (
                          <>
                            <div className="mt-3 font-medium">{t("where")}</div>
                            <div className="col-span-2 mt-3" data-testid="where">
                              {!rescheduleLocation || locationToDisplay === rescheduleLocationToDisplay ? (
                                <DisplayLocation
                                  locationToDisplay={locationToDisplay}
                                  providerName={providerName}
                                />
                              ) : (
                                <>
                                  {!!formerTime && (
                                    <DisplayLocation
                                      locationToDisplay={locationToDisplay}
                                      providerName={providerName}
                                      className="line-through"
                                    />
                                  )}

                                  <DisplayLocation
                                    locationToDisplay={rescheduleLocationToDisplay}
                                    providerName={rescheduleProviderName}
                                  />
                                </>
                              )}
                            </div>
                          </>
                        )}
                        {props.paymentStatus && (
                          <>
                            <div className="mt-3 font-medium">
                              {props.paymentStatus.paymentOption === "HOLD"
                                ? t("complete_your_booking")
                                : t("payment")}
                            </div>
                            <div className="col-span-2 mb-2 mt-3">
                              <Price
                                currency={props.paymentStatus.currency}
                                price={props.paymentStatus.amount}
                              />
                            </div>
                          </>
                        )}

                        {rescheduledToUid ? <RescheduledToLink rescheduledToUid={rescheduledToUid} /> : null}

                        {bookingInfo?.description && (
                          <>
                            <div className="mt-9 font-medium">{t("additional_notes")}</div>
                            <div className="col-span-2 mb-2 mt-9">
                              <p className="break-words">{bookingInfo.description}</p>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-bookingdark dark:border-darkgray-200 mt-8 text-left dark:text-gray-300">
                        {eventType.bookingFields.map((field) => {
                          if (!field) return null;

                          if (!bookingInfo.responses[field.name]) return null;

                          const response = bookingInfo.responses[field.name];
                          // We show location in the "where" section
                          // We show Booker Name, Emails and guests in Who section
                          // We show notes in additional notes section
                          // We show rescheduleReason at the top

                          const isSystemField = SystemField.safeParse(field.name);
                          // SMS_REMINDER_NUMBER_FIELD is a system field but doesn't have a dedicated place in the UI. So, it would be shown through the following responses list
                          // TITLE is also an identifier for booking question "What is this meeting about?"
                          if (
                            isSystemField.success &&
                            field.name !== SMS_REMINDER_NUMBER_FIELD &&
                            field.name !== TITLE_FIELD
                          )
                            return null;

                          const label = field.label || t(field.defaultLabel);

                          return (
                            <>
                              <div
                                className="text-emphasis mt-4 font-medium"
                                // eslint-disable-next-line react/no-danger
                                dangerouslySetInnerHTML={{
                                  __html: markdownToSafeHTML(label),
                                }}
                              />
                              <p
                                className="text-default break-words"
                                data-testid="field-response"
                                data-fob-field={field.name}>
                                {field.type === "boolean"
                                  ? response
                                    ? t("yes")
                                    : t("no")
                                  : response.toString()}
                              </p>
                            </>
                          );
                        })}
                      </div>
                    </div>
                    {requiresLoginToUpdate && (
                      <>
                        <hr className="border-subtle mb-8" />
                        <div className="text-center">
                          <span className="text-emphasis ltr:mr-2 rtl:ml-2">
                            {t("need_to_make_a_change")}
                          </span>
                          {/* Login button but redirect to here */}
                          <span className="text-default inline">
                            <span className="underline" data-testid="reschedule-link">
                              <Link
                                href={`/auth/login?callbackUrl=${encodeURIComponent(
                                  `/booking/${bookingInfo?.uid}`
                                )}`}
                                legacyBehavior>
                                {t("login")}
                              </Link>
                            </span>
                          </span>
                        </div>
                      </>
                    )}
                    {!requiresLoginToUpdate &&
                      (!needsConfirmation || !userIsOwner) &&
                      isReschedulable &&
                      !isRerouting &&
                      (!isCancellationMode ? (
                        <>
                          <hr className="border-subtle mb-8" />
                          <div className="text-center last:pb-0">
                            <span className="text-emphasis ltr:mr-2 rtl:ml-2">
                              {t("need_to_make_a_change")}
                            </span>

                            <>
                              {!props.recurringBookings && !isBookingInPast && (
                                <span className="text-default inline">
                                  <span className="underline" data-testid="reschedule-link">
                                    <Link
                                      href={`/reschedule/${seatReferenceUid || bookingInfo?.uid}${
                                        currentUserEmail
                                          ? `?rescheduledBy=${encodeURIComponent(currentUserEmail)}`
                                          : ""
                                      }`}
                                      legacyBehavior>
                                      {t("reschedule")}
                                    </Link>
                                  </span>
                                  <span className="mx-2">{t("or_lowercase")}</span>
                                </span>
                              )}

                              <button
                                data-testid="cancel"
                                className={classNames(
                                  "text-default underline",
                                  props.recurringBookings && "ltr:mr-2 rtl:ml-2"
                                )}
                                onClick={() => setIsCancellationMode(true)}>
                                {t("cancel")}
                              </button>
                            </>
                          </div>
                        </>
                      ) : (
                        <>
                          <hr className="border-subtle" />
                          <CancelBooking
                            booking={{
                              uid: bookingInfo?.uid,
                              title: bookingInfo?.title,
                              id: bookingInfo?.id,
                            }}
                            profile={{ name: props.profile.name, slug: props.profile.slug }}
                            recurringEvent={eventType.recurringEvent}
                            team={eventType?.team?.name}
                            setIsCancellationMode={setIsCancellationMode}
                            theme={isSuccessBookingPage ? props.profile.theme : "light"}
                            allRemainingBookings={allRemainingBookings}
                            seatReferenceUid={seatReferenceUid}
                            bookingCancelledEventProps={bookingCancelledEventProps}
                            currentUserEmail={currentUserEmail}
                          />
                        </>
                      ))}
                    {isRerouting && typeof window !== "undefined" && window.opener && (
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          onClick={() => {
                            window.opener.focus();
                            window.close();
                          }}>
                          Go Back
                        </Button>
                      </div>
                    )}
                    {!needsConfirmation && !isCancellationMode && isReschedulable && !!calculatedDuration && (
                      <>
                        <hr className="border-subtle mt-8" />
                        <div className="text-default align-center flex flex-row justify-center pt-8">
                          <span className="text-default flex self-center font-medium ltr:mr-2 rtl:ml-2 ">
                            {t("add_to_calendar")}
                          </span>
                          <div className="justify-left mt-1 flex text-left sm:mt-0">
                            <Link
                              href={`https://calendar.google.com/calendar/r/eventedit?dates=${date
                                .utc()
                                .format("YYYYMMDDTHHmmss[Z]")}/${date
                                .add(calculatedDuration, "minute")
                                .utc()
                                .format("YYYYMMDDTHHmmss[Z]")}&text=${eventName}&details=${
                                eventType.description
                              }${
                                typeof locationVideoCallUrl === "string"
                                  ? `&location=${encodeURIComponent(locationVideoCallUrl)}`
                                  : ""
                              }${
                                eventType.recurringEvent
                                  ? `&recur=${encodeURIComponent(
                                      new RRule(eventType.recurringEvent).toString()
                                    )}`
                                  : ""
                              }`}
                              className="text-default border-subtle h-10 w-10 rounded-sm border px-3 py-2 ltr:mr-2 rtl:ml-2">
                              <svg
                                className="-mt-1.5 inline-block h-4 w-4"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24">
                                <title>Google</title>
                                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                              </svg>
                            </Link>
                            <Link
                              href={`data:text/calendar,${eventLink()}`}
                              className="border-subtle text-default mx-2 h-10 w-10 rounded-sm border px-3 py-2"
                              download={`${eventType.title}.ics`}>
                              <svg
                                version="1.1"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 1000 1000"
                                className="-mt-1.5 mr-1 inline-block h-4 w-4">
                                <title>{t("other")}</title>
                                <path d="M971.3,154.9c0-34.7-28.2-62.9-62.9-62.9H611.7c-1.3,0-2.6,0.1-3.9,0.2V10L28.7,87.3v823.4L607.8,990v-84.6c1.3,0.1,2.6,0.2,3.9,0.2h296.7c34.7,0,62.9-28.2,62.9-62.9V154.9z M607.8,636.1h44.6v-50.6h-44.6v-21.9h44.6v-50.6h-44.6v-92h277.9v230.2c0,3.8-3.1,7-7,7H607.8V636.1z M117.9,644.7l-50.6-2.4V397.5l50.6-2.2V644.7z M288.6,607.3c17.6,0.6,37.3-2.8,49.1-7.2l9.1,48c-11,5.1-35.6,9.9-66.9,8.3c-85.4-4.3-127.5-60.7-127.5-132.6c0-86.2,57.8-136.7,133.2-140.1c30.3-1.3,53.7,4,64.3,9.2l-12.2,48.9c-12.1-4.9-28.8-9.2-49.5-8.6c-45.3,1.2-79.5,30.1-79.5,87.4C208.8,572.2,237.8,605.7,288.6,607.3z M455.5,665.2c-32.4-1.6-63.7-11.3-79.1-20.5l12.6-50.7c16.8,9.1,42.9,18.5,70.4,19.4c30.1,1,46.3-10.7,46.3-29.3c0-17.8-14-28.1-48.8-40.6c-46.9-16.4-76.8-41.7-76.8-81.5c0-46.6,39.3-84.1,106.8-87.1c33.3-1.5,58.3,4.2,76.5,11.2l-15.4,53.3c-12.1-5.3-33.5-12.8-62.3-12c-28.3,0.8-41.9,13.6-41.9,28.1c0,17.8,16.1,25.5,53.6,39c52.9,18.5,78.4,45.3,78.4,86.4C575.6,629.7,536.2,669.2,455.5,665.2z M935.3,842.7c0,14.9-12.1,27-27,27H611.7c-1.3,0-2.6-0.2-3.9-0.4V686.2h270.9c19.2,0,34.9-15.6,34.9-34.9V398.4c0-19.2-15.6-34.9-34.9-34.9h-47.1v-32.3H808v32.3h-44.8v-32.3h-22.7v32.3h-43.3v-32.3h-22.7v32.3H628v-32.3h-20.2v-203c1.31.2,2.6-0.4,3.9-0.4h296.7c14.9,0,27,12.1,27,27L935.3,842.7L935.3,842.7z" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      </>
                    )}

                    {session === null && !(userIsOwner || props.hideBranding) && (
                      <>
                        <hr className="border-subtle mt-8" />
                        <div className="text-default pt-8 text-center text-xs">
                          <a href="https://cal.com/signup">
                            {t("create_booking_link_with_calcom", { appName: APP_NAME })}
                          </a>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const target = e.target as typeof e.target & {
                                email: { value: string };
                              };
                              router.push(`https://cal.com/signup?email=${target.email.value}`);
                            }}
                            className="mt-4 flex">
                            <EmailInput
                              name="email"
                              id="email"
                              defaultValue={email}
                              className="mr- focus:border-brand-default border-default text-default mt-0 block w-full rounded-none rounded-l-md shadow-sm focus:ring-black sm:text-sm"
                              placeholder="rick.astley@cal.com"
                            />
                            <Button
                              size="lg"
                              type="submit"
                              className="min-w-max rounded-none rounded-r-md"
                              color="primary">
                              {t("try_for_free")}
                            </Button>
                          </form>
                        </div>
                      </>
                    )}
                  </>
                )}
                {isFeedbackMode &&
                  (noShow ? (
                    <>
                      <EmptyScreen
                        Icon="user-x"
                        iconClassName="text-error"
                        iconWrapperClassName="bg-error"
                        headline={t("host_no_show")}
                        description={t("no_show_description")}
                        buttonRaw={
                          !props.recurringBookings ? (
                            <Button href={`/reschedule/${seatReferenceUid || bookingInfo?.uid}`}>
                              {t("reschedule")}
                            </Button>
                          ) : undefined
                        }
                      />
                    </>
                  ) : (
                    <>
                      <div className="my-3 flex justify-center space-x-1">
                        <button
                          className={classNames(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-2xl hover:opacity-100",
                            rateValue === 1
                              ? "border-focus bg-emphasis"
                              : "border-muted bg-default opacity-50"
                          )}
                          disabled={isFeedbackSubmitted}
                          onClick={() => setRateValue(1)}>
                          😠
                        </button>
                        <button
                          className={classNames(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-2xl hover:opacity-100",
                            rateValue === 2
                              ? "border-focus bg-emphasis"
                              : "border-muted bg-default opacity-50"
                          )}
                          disabled={isFeedbackSubmitted}
                          onClick={() => setRateValue(2)}>
                          🙁
                        </button>
                        <button
                          className={classNames(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-2xl hover:opacity-100",
                            rateValue === 3
                              ? "border-focus bg-emphasis"
                              : " border-muted bg-default opacity-50"
                          )}
                          disabled={isFeedbackSubmitted}
                          onClick={() => setRateValue(3)}>
                          😐
                        </button>
                        <button
                          className={classNames(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-2xl hover:opacity-100",
                            rateValue === 4
                              ? "border-focus bg-emphasis"
                              : "border-muted bg-default opacity-50"
                          )}
                          disabled={isFeedbackSubmitted}
                          onClick={() => setRateValue(4)}>
                          😄
                        </button>
                        <button
                          className={classNames(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-2xl hover:opacity-100",
                            rateValue === 5
                              ? "border-focus bg-emphasis"
                              : "border-muted bg-default opacity-50"
                          )}
                          disabled={isFeedbackSubmitted}
                          onClick={() => setRateValue(5)}>
                          😍
                        </button>
                      </div>
                      <div className="my-4 space-y-1 text-center">
                        <h2 className="font-cal text-lg">{t("submitted_feedback")}</h2>
                        <p className="text-sm">{rateValue < 4 ? t("how_can_we_improve") : t("most_liked")}</p>
                      </div>
                      <TextArea
                        id="comment"
                        name="comment"
                        placeholder="Next time I would like to ..."
                        rows={3}
                        disabled={isFeedbackSubmitted}
                        onChange={(event) => setComment(event.target.value)}
                      />
                      <div className="my-4 flex justify-start">
                        <Button
                          loading={mutation.isPending}
                          disabled={isFeedbackSubmitted}
                          onClick={async () => {
                            if (rating) {
                              await sendFeedback(rating, comment);
                            }
                          }}>
                          {t("submit_feedback")}
                        </Button>
                      </div>
                    </>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

const RescheduledToLink = ({ rescheduledToUid }: { rescheduledToUid: string }) => {
  const { t } = useLocale();
  return (
    <>
      <div className="mt-3 font-medium">{t("rescheduled")}</div>
      <div className="col-span-2 mb-2 mt-3">
        <span className="underline">
          <Link href={`/booking/${rescheduledToUid}`}>
            <div className="flex items-center gap-1">
              {t("view_booking")}
              <Icon name="external-link" className="h-4 w-4" />
            </div>
          </Link>
        </span>
      </div>
    </>
  );
};

const DisplayLocation = ({
  locationToDisplay,
  providerName,
  className,
}: {
  locationToDisplay: string;
  providerName?: string;
  className?: string;
}) =>
  locationToDisplay.startsWith("http") ? (
    <a
      href={locationToDisplay}
      target="_blank"
      title={locationToDisplay}
      className={classNames("text-default flex items-center gap-2", className)}
      rel="noreferrer">
      {providerName || "Link"}
      <Icon name="external-link" className="text-default inline h-4 w-4" />
    </a>
  ) : (
    <p className={className}>{locationToDisplay}</p>
  );

Success.isBookingPage = true;

type RecurringBookingsProps = {
  eventType: PageProps["eventType"];
  recurringBookings: PageProps["recurringBookings"];
  date: dayjs.Dayjs;
  duration: number | undefined;
  is24h: boolean;
  allRemainingBookings: boolean;
  isCancelled: boolean;
  tz: string;
};

function RecurringBookings({
  eventType,
  recurringBookings,
  duration,
  date,
  allRemainingBookings,
  is24h,
  isCancelled,
  tz,
}: RecurringBookingsProps) {
  const [moreEventsVisible, setMoreEventsVisible] = useState(false);
  const {
    t,
    i18n: { language },
  } = useLocale();
  const recurringBookingsSorted = recurringBookings
    ? recurringBookings.sort((a: ConfigType, b: ConfigType) => (dayjs(a).isAfter(dayjs(b)) ? 1 : -1))
    : null;

  if (!duration) return null;

  if (recurringBookingsSorted && allRemainingBookings) {
    return (
      <>
        {eventType.recurringEvent?.count && (
          <span className="font-medium">
            {getEveryFreqFor({
              t,
              recurringEvent: eventType.recurringEvent,
              recurringCount: recurringBookings?.length ?? undefined,
            })}
          </span>
        )}
        {eventType.recurringEvent?.count &&
          recurringBookingsSorted.slice(0, 4).map((dateStr: string, idx: number) => (
            <div key={idx} className={classNames("mb-2", isCancelled ? "line-through" : "")}>
              {formatToLocalizedDate(dayjs.tz(dateStr, tz), language, "full", tz)}
              <br />
              {formatToLocalizedTime(dayjs(dateStr), language, undefined, !is24h, tz)} -{" "}
              {formatToLocalizedTime(dayjs(dateStr).add(duration, "m"), language, undefined, !is24h, tz)}{" "}
              <span className="text-bookinglight">
                ({formatToLocalizedTimezone(dayjs(dateStr), language, tz)})
              </span>
            </div>
          ))}
        {recurringBookingsSorted.length > 4 && (
          <Collapsible open={moreEventsVisible} onOpenChange={() => setMoreEventsVisible(!moreEventsVisible)}>
            <CollapsibleTrigger
              type="button"
              className={classNames("flex w-full", moreEventsVisible ? "hidden" : "")}>
              + {t("plus_more", { count: recurringBookingsSorted.length - 4 })}
            </CollapsibleTrigger>
            <CollapsibleContent>
              {eventType.recurringEvent?.count &&
                recurringBookingsSorted.slice(4).map((dateStr: string, idx: number) => (
                  <div key={idx} className={classNames("mb-2", isCancelled ? "line-through" : "")}>
                    {formatToLocalizedDate(dayjs.tz(dateStr, tz), language, "full", tz)}
                    <br />
                    {formatToLocalizedTime(dayjs(dateStr), language, undefined, !is24h, tz)} -{" "}
                    {formatToLocalizedTime(
                      dayjs(dateStr).add(duration, "m"),
                      language,
                      undefined,
                      !is24h,
                      tz
                    )}{" "}
                    <span className="text-bookinglight">
                      ({formatToLocalizedTimezone(dayjs(dateStr), language, tz)})
                    </span>
                  </div>
                ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </>
    );
  }

  return (
    <div className={classNames(isCancelled ? "line-through" : "")}>
      {formatToLocalizedDate(date, language, "full", tz)}
      <br />
      {formatToLocalizedTime(date, language, undefined, !is24h, tz)} -{" "}
      {formatToLocalizedTime(dayjs(date).add(duration, "m"), language, undefined, !is24h, tz)}{" "}
      <span className="text-bookinglight">({formatToLocalizedTimezone(date, language, tz)})</span>
    </div>
  );
}
