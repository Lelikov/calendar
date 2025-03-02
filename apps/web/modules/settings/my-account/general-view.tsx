"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import { classNames } from "@calcom/lib";
import { formatLocalizedDateTime } from "@calcom/lib/date-fns";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { localeOptions } from "@calcom/lib/i18n";
import { nameOfDay } from "@calcom/lib/weekday";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import {
  Button,
  Form,
  Label,
  Select,
  showToast,
  SkeletonButton,
  SkeletonContainer,
  SkeletonText,
  TimezoneSelect,
} from "@calcom/ui";

import TravelScheduleModal from "@components/settings/TravelScheduleModal";

export type FormValues = {
  locale: {
    value: string;
    label: string;
  };
  timeZone: string;
  timeFormat: {
    value: number;
    label: string | number;
  };
  weekStart: {
    value: string;
    label: string;
  };
  travelSchedules: {
    id?: number;
    startDate: Date;
    endDate?: Date;
    timeZone: string;
  }[];
};

const SkeletonLoader = () => {
  return (
    <SkeletonContainer>
      <div className="border-subtle space-y-6 rounded-b-xl border border-t-0 px-4 py-8 sm:px-6">
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />

        <SkeletonButton className="ml-auto h-8 w-20 rounded-md p-5" />
      </div>
    </SkeletonContainer>
  );
};

interface GeneralViewProps {
  localeProp: string;
  user: RouterOutputs["viewer"]["me"];
  travelSchedules: RouterOutputs["viewer"]["getTravelSchedules"];
  revalidatePage: GeneralQueryViewProps["revalidatePage"];
}

type GeneralQueryViewProps = {
  revalidatePage: () => Promise<void>;
};

const GeneralQueryView = ({ revalidatePage }: GeneralQueryViewProps) => {
  const { t } = useLocale();

  const { data: user, isPending } = trpc.viewer.me.useQuery();

  const { data: travelSchedules, isPending: isPendingTravelSchedules } =
    trpc.viewer.getTravelSchedules.useQuery();

  if (isPending || isPendingTravelSchedules) return <SkeletonLoader />;
  if (!user) {
    throw new Error(t("something_went_wrong"));
  }
  return (
    <GeneralView
      user={user}
      travelSchedules={travelSchedules || []}
      localeProp={user.locale}
      revalidatePage={revalidatePage}
    />
  );
};

const GeneralView = ({ localeProp, user, travelSchedules, revalidatePage }: GeneralViewProps) => {
  const utils = trpc.useContext();
  const {
    t,
    i18n: { language },
  } = useLocale();
  const { update } = useSession();
  const [isUpdateBtnLoading, setIsUpdateBtnLoading] = useState<boolean>(false);
  const [isTZScheduleOpen, setIsTZScheduleOpen] = useState<boolean>(false);

  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: async (res) => {
      await utils.viewer.me.invalidate();
      reset(getValues());
      showToast(t("settings_updated_successfully"), "success");
      await update(res);

      if (res.locale) {
        window.calNewLocale = res.locale;
        document.cookie = `calNewLocale=${res.locale}; path=/`;
      }
      await revalidatePage();
    },
    onError: () => {
      showToast(t("error_updating_settings"), "error");
    },
    onSettled: async () => {
      await utils.viewer.me.invalidate();
      setIsUpdateBtnLoading(false);
    },
  });

  const timeFormatOptions = [
    { value: 12, label: t("12_hour") },
    { value: 24, label: t("24_hour") },
  ];

  const weekStartOptions = [
    { value: "Sunday", label: nameOfDay(localeProp, 0) },
    { value: "Monday", label: nameOfDay(localeProp, 1) },
    { value: "Tuesday", label: nameOfDay(localeProp, 2) },
    { value: "Wednesday", label: nameOfDay(localeProp, 3) },
    { value: "Thursday", label: nameOfDay(localeProp, 4) },
    { value: "Friday", label: nameOfDay(localeProp, 5) },
    { value: "Saturday", label: nameOfDay(localeProp, 6) },
  ];

  const formMethods = useForm<FormValues>({
    defaultValues: {
      locale: {
        value: localeProp || "",
        label: localeOptions.find((option) => option.value === localeProp)?.label || "",
      },
      timeZone: user.timeZone || "",
      timeFormat: {
        value: user.timeFormat || 12,
        label: timeFormatOptions.find((option) => option.value === user.timeFormat)?.label || 12,
      },
      weekStart: {
        value: user.weekStart,
        label: nameOfDay(localeProp, user.weekStart === "Sunday" ? 0 : 1),
      },
      travelSchedules:
        travelSchedules.map((schedule) => {
          return {
            id: schedule.id,
            startDate: schedule.startDate,
            endDate: schedule.endDate ?? undefined,
            timeZone: schedule.timeZone,
          };
        }) || [],
    },
  });
  const {
    formState: { isDirty, isSubmitting },
    reset,
    getValues,
  } = formMethods;
  const isDisabled = isSubmitting || !isDirty;

  const [isAllowDynamicBookingChecked, setIsAllowDynamicBookingChecked] = useState(
    !!user.allowDynamicBooking
  );
  const [isAllowSEOIndexingChecked, setIsAllowSEOIndexingChecked] = useState(
    user.organizationSettings?.allowSEOIndexing === false
      ? !!user.organizationSettings?.allowSEOIndexing
      : !!user.allowSEOIndexing
  );
  const [isReceiveMonthlyDigestEmailChecked, setIsReceiveMonthlyDigestEmailChecked] = useState(
    !!user.receiveMonthlyDigestEmail
  );

  const watchedTzSchedules = formMethods.watch("travelSchedules");

  return (
    <div>
      <Form
        form={formMethods}
        handleSubmit={async (values) => {
          setIsUpdateBtnLoading(true);
          mutation.mutate({
            ...values,
            locale: values.locale.value,
            timeFormat: values.timeFormat.value,
            weekStart: values.weekStart.value,
          });
        }}>
        <div className="border-subtle border-x border-y-0 px-4 py-8 sm:px-6">
          <Controller
            name="locale"
            render={({ field: { value, onChange } }) => (
              <>
                <Label className="text-emphasis">
                  <>{t("language")}</>
                </Label>
                <Select<{ label: string; value: string }>
                  className="capitalize"
                  options={localeOptions}
                  value={value}
                  onChange={onChange}
                />
              </>
            )}
          />
          <Controller
            name="timeZone"
            control={formMethods.control}
            render={({ field: { value } }) => (
              <>
                <Label className="text-emphasis mt-6">
                  <>{t("timezone")}</>
                </Label>
                <TimezoneSelect
                  id="timezone"
                  value={value}
                  onChange={(event) => {
                    if (event) formMethods.setValue("timeZone", event.value, { shouldDirty: true });
                  }}
                />
              </>
            )}
          />
          {!watchedTzSchedules.length ? (
            <Button
              color="secondary"
              className="mt-2"
              StartIcon="calendar"
              onClick={() => setIsTZScheduleOpen(true)}>
              {t("schedule_timezone_change")}
            </Button>
          ) : (
            <div className="bg-muted border-subtle mt-2 rounded-md border p-4">
              <Label>{t("travel_schedule")}</Label>
              <div className="dark:bg-darkgray-100 border-subtle mt-4 rounded-md border bg-white text-sm">
                {watchedTzSchedules.map((schedule, index) => {
                  return (
                    <div
                      className={classNames(
                        "flex items-center p-4",
                        index !== 0 ? "border-subtle border-t" : ""
                      )}
                      key={index}>
                      <div>
                        <div className="text-emphasis font-semibold">{`${formatLocalizedDateTime(
                          schedule.startDate,
                          { day: "numeric", month: "long" },
                          language
                        )} ${
                          schedule.endDate
                            ? `- ${formatLocalizedDateTime(
                                schedule.endDate,
                                { day: "numeric", month: "long" },
                                language
                              )}`
                            : ``
                        }`}</div>
                        <div className="text-subtle">{schedule.timeZone.replace(/_/g, " ")}</div>
                      </div>
                      <Button
                        color="secondary"
                        className="ml-auto"
                        variant="icon"
                        StartIcon="trash-2"
                        onClick={() => {
                          const updatedSchedules = watchedTzSchedules.filter(
                            (s, filterIndex) => filterIndex !== index
                          );
                          formMethods.setValue("travelSchedules", updatedSchedules, { shouldDirty: true });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <Button
                StartIcon="plus"
                color="secondary"
                className="mt-4"
                onClick={() => setIsTZScheduleOpen(true)}>
                {t("add")}
              </Button>
            </div>
          )}
        </div>

        <SectionBottomActions align="end">
          <Button loading={isUpdateBtnLoading} disabled={isDisabled} color="primary" type="submit">
            <>{t("update")}</>
          </Button>
        </SectionBottomActions>
      </Form>

      <TravelScheduleModal
        open={isTZScheduleOpen}
        onOpenChange={() => setIsTZScheduleOpen(false)}
        setValue={formMethods.setValue}
        existingSchedules={formMethods.getValues("travelSchedules") ?? []}
      />
    </div>
  );
};

export default GeneralQueryView;
