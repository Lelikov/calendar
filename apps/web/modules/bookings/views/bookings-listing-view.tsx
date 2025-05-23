"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Fragment, useState } from "react";
import type { z } from "zod";

import { WipeMyCalActionButton } from "@calcom/app-store/wipemycalother/components";
import dayjs from "@calcom/dayjs";
import { FilterToggle } from "@calcom/features/bookings/components/FilterToggle";
import { FiltersContainer } from "@calcom/features/bookings/components/FiltersContainer";
import type { filterQuerySchema } from "@calcom/features/bookings/lib/useFilterQuery";
import { useFilterQuery } from "@calcom/features/bookings/lib/useFilterQuery";
import Shell from "@calcom/features/shell/Shell";
import { useInViewObserver } from "@calcom/lib/hooks/useInViewObserver";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import type { HorizontalTabItemProps, VerticalTabItemProps } from "@calcom/ui";
import { Alert, Button, EmptyScreen, HorizontalTabs } from "@calcom/ui";

import useMeQuery from "@lib/hooks/useMeQuery";

import BookingListItem from "@components/booking/BookingListItem";
import SkeletonLoader from "@components/booking/SkeletonLoader";

import type { validStatuses } from "~/bookings/lib/validStatuses";

type BookingListingStatus = z.infer<NonNullable<typeof filterQuerySchema>>["status"];
type BookingOutput = RouterOutputs["viewer"]["bookings"]["get"]["bookings"][0];

type RecurringInfo = {
  recurringEventId: string | null;
  count: number;
  firstDate: Date | null;
  bookings: { [key: string]: Date[] };
};

const tabs: (VerticalTabItemProps | HorizontalTabItemProps)[] = [
  {
    name: "upcoming",
    href: "/bookings/upcoming",
  },
  // {
  //   name: "unconfirmed",
  //   href: "/bookings/unconfirmed",
  // },
  // {
  //   name: "recurring",
  //   href: "/bookings/recurring",
  // },
  {
    name: "past",
    href: "/bookings/past",
  },
  {
    name: "cancelled",
    href: "/bookings/cancelled",
  },
];

const descriptionByStatus: Record<NonNullable<BookingListingStatus>, string> = {
  upcoming: "upcoming_bookings",
  recurring: "recurring_bookings",
  past: "past_bookings",
  cancelled: "cancelled_bookings",
  unconfirmed: "unconfirmed_bookings",
};

export default function Bookings({ status }: { status: (typeof validStatuses)[number] }) {
  const { data: filterQuery } = useFilterQuery();

  const { t } = useLocale();
  const user = useMeQuery().data;
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(false);

  const query = trpc.viewer.bookings.get.useInfiniteQuery(
    {
      limit: 10,
      filters: {
        ...filterQuery,
        status: filterQuery.status ?? status,
      },
    },
    {
      enabled: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Animate page (tab) transitions to look smoothing

  const buttonInView = useInViewObserver(() => {
    if (!query.isFetching && query.hasNextPage && query.status === "success") {
      query.fetchNextPage();
    }
  });

  const isEmpty = !query.data?.pages[0]?.bookings.length;

  const shownBookings: Record<string, BookingOutput[]> = {};
  const filterBookings = (booking: BookingOutput) => {
    if (status === "recurring" || status == "unconfirmed" || status === "cancelled") {
      if (!booking.recurringEventId) {
        return true;
      }
      if (
        shownBookings[booking.recurringEventId] !== undefined &&
        shownBookings[booking.recurringEventId].length > 0
      ) {
        shownBookings[booking.recurringEventId].push(booking);
        return false;
      }
      shownBookings[booking.recurringEventId] = [booking];
    } else if (status === "upcoming") {
      return (
        dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") !==
        dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
      );
    }
    return true;
  };

  let recurringInfoToday: RecurringInfo | undefined;

  const bookingsToday =
    query.data?.pages.map((page) =>
      page.bookings.filter((booking: BookingOutput) => {
        recurringInfoToday = page.recurringInfo.find(
          (info) => info.recurringEventId === booking.recurringEventId
        );

        return (
          dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") ===
          dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
        );
      })
    )[0] || [];

  const [animationParentRef] = useAutoAnimate<HTMLDivElement>();

  return (
    <Shell
      withoutMain={false}
      hideHeadingOnMobile
      heading={t("bookings")}
      subtitle={t("bookings_description")}
      title={t("bookings")}
      description={t("bookings_description")}>
      <div className="flex flex-col">
        <div className="flex flex-row flex-wrap justify-between">
          <HorizontalTabs tabs={tabs} />
          <FilterToggle setIsFiltersVisible={setIsFiltersVisible} />
        </div>
        <FiltersContainer isFiltersVisible={isFiltersVisible} />
        <main className="w-full">
          <div className="flex w-full flex-col" ref={animationParentRef}>
            {query.status === "error" && (
              <Alert severity="error" title={t("something_went_wrong")} message={query.error.message} />
            )}
            {(query.status === "pending" || query.isPaused) && <SkeletonLoader />}
            {query.status === "success" && !isEmpty && (
              <>
                {!!bookingsToday.length && status === "upcoming" && (
                  <div className="mb-6 pt-2 xl:pt-0">
                    <WipeMyCalActionButton bookingStatus={status} bookingsEmpty={isEmpty} />
                    <p className="text-subtle mb-2 text-xs font-medium uppercase leading-4">{t("today")}</p>
                    <div className="border-subtle overflow-hidden rounded-md border">
                      <table className="w-full max-w-full table-fixed">
                        <tbody className="bg-default divide-subtle divide-y" data-testid="today-bookings">
                          <Fragment>
                            {bookingsToday.map((booking: BookingOutput) => (
                              <BookingListItem
                                key={booking.id}
                                loggedInUser={{
                                  userId: user?.id,
                                  userTimeZone: user?.timeZone,
                                  userTimeFormat: user?.timeFormat,
                                  userEmail: user?.email,
                                }}
                                listingStatus={status}
                                recurringInfo={recurringInfoToday}
                                {...booking}
                              />
                            ))}
                          </Fragment>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="pt-2 xl:pt-0">
                  <div className="border-subtle overflow-hidden rounded-md border">
                    <table data-testid={`${status}-bookings`} className="w-full max-w-full table-fixed">
                      <tbody className="bg-default divide-subtle divide-y" data-testid="bookings">
                        {query.data.pages.map((page, index) => (
                          <Fragment key={index}>
                            {page.bookings.filter(filterBookings).map((booking: BookingOutput) => {
                              const recurringInfo = page.recurringInfo.find(
                                (info) => info.recurringEventId === booking.recurringEventId
                              );
                              return (
                                <BookingListItem
                                  key={booking.id}
                                  loggedInUser={{
                                    userId: user?.id,
                                    userTimeZone: user?.timeZone,
                                    userTimeFormat: user?.timeFormat,
                                    userEmail: user?.email,
                                  }}
                                  listingStatus={status}
                                  recurringInfo={recurringInfo}
                                  {...booking}
                                />
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-default p-4 text-center" ref={buttonInView.ref}>
                    <Button
                      color="minimal"
                      loading={query.isFetchingNextPage}
                      disabled={!query.hasNextPage}
                      onClick={() => query.fetchNextPage()}>
                      {query.hasNextPage ? t("load_more_results") : t("no_more_results")}
                    </Button>
                  </div>
                </div>
              </>
            )}
            {query.status === "success" && isEmpty && (
              <div className="flex items-center justify-center pt-2 xl:pt-0">
                <EmptyScreen
                  Icon="calendar"
                  headline={t("no_status_bookings_yet", { status: t(status).toLowerCase() })}
                  description={t("no_status_bookings_yet_description", {
                    status: t(status).toLowerCase(),
                    description: t(descriptionByStatus[status]),
                  })}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </Shell>
  );
}
