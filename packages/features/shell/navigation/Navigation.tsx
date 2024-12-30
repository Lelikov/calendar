import { useSession } from "next-auth/react";
import { useMemo } from "react";

import { useIsEmbed } from "@calcom/embed-core/embed-iframe";
import UnconfirmedBookingBadge from "@calcom/features/bookings/UnconfirmedBookingBadge";
import {
  useOrgBranding,
  type OrganizationBranding,
} from "@calcom/features/ee/organizations/context/provider";
import { KBarTrigger } from "@calcom/features/kbar/Kbar";
import { classNames } from "@calcom/lib";

import { TeamInviteBadge } from "../TeamInviteBadge";
import type { NavigationItemType } from "./NavigationItem";
import { NavigationItem, MobileNavigationItem, MobileNavigationMoreItem } from "./NavigationItem";

export const MORE_SEPARATOR_NAME = "more";

const getNavigationItems = (orgBranding: OrganizationBranding): NavigationItemType[] => [
  {
    name: "event_types_page_title",
    href: "/event-types",
    icon: "link",
    onlyAdmin: true,
  },
  {
    name: "bookings",
    href: "/bookings/upcoming",
    icon: "calendar",
    onlyAdmin: false,
    badge: <UnconfirmedBookingBadge />,
    isCurrent: ({ pathname }) => pathname?.startsWith("/bookings") ?? false,
  },
  {
    name: "availability",
    onlyAdmin: false,
    href: "/availability",
    icon: "clock",
  },
  ...(orgBranding
    ? [
        {
          name: "members",
          href: `/settings/organizations/${orgBranding.slug}/members`,
          icon: "building",
          moreOnMobile: true,
          onlyAdmin: true,
        } satisfies NavigationItemType,
      ]
    : []),
  {
    name: "teams",
    href: "/teams",
    icon: "users",
    onlyDesktop: true,
    onlyAdmin: true,
    badge: <TeamInviteBadge />,
  },
  {
    name: "apps",
    href: "/apps",
    icon: "grid-3x3",
    onlyAdmin: true,
    isCurrent: ({ pathname: path, item }) => {
      // During Server rendering path is /v2/apps but on client it becomes /apps(weird..)
      return (path?.startsWith(item.href) ?? false) && !(path?.includes("routing-forms/") ?? false);
    },
    child: [
      {
        name: "app_store",
        href: "/apps",
        isCurrent: ({ pathname: path, item }) => {
          // During Server rendering path is /v2/apps but on client it becomes /apps(weird..)
          return (
            (path?.startsWith(item.href) ?? false) &&
            !(path?.includes("routing-forms/") ?? false) &&
            !(path?.includes("/installed") ?? false)
          );
        },
      },
      {
        name: "installed_apps",
        href: "/apps/installed/calendar",
        isCurrent: ({ pathname: path }) =>
          (path?.startsWith("/apps/installed/") ?? false) ||
          (path?.startsWith("/v2/apps/installed/") ?? false),
      },
    ],
  },
  {
    name: MORE_SEPARATOR_NAME,
    href: "/more",
    icon: "ellipsis",
  },
  {
    name: "routing_forms",
    href: "/apps/routing-forms/forms",
    icon: "file-text",
    onlyAdmin: true,
    isCurrent: ({ pathname }) => pathname?.startsWith("/apps/routing-forms/") ?? false,
    moreOnMobile: true,
  },
  {
    name: "workflows",
    href: "/workflows",
    icon: "zap",
    onlyAdmin: true,
    moreOnMobile: true,
  },
  {
    name: "insights",
    href: "/insights",
    icon: "chart-bar",
    onlyAdmin: true,
    isCurrent: ({ pathname: path, item }) => path?.startsWith(item.href) ?? false,
    moreOnMobile: true,
    child: [
      {
        name: "bookings",
        href: "/insights",
        isCurrent: ({ pathname: path }) => path == "/insights" ?? false,
      },
      {
        name: "routing",
        href: "/insights/routing",
        isCurrent: ({ pathname: path }) => path?.startsWith("/insights/routing") ?? false,
      },
      {
        name: "router_position",
        href: "/insights/virtual-queues",
        isCurrent: ({ pathname: path }) => path?.startsWith("/insights/virtual-queues") ?? false,
      },
    ],
  },
];

const platformNavigationItems: NavigationItemType[] = [
  {
    name: "Dashboard",
    href: "/settings/platform/",
    icon: "layout-dashboard",
  },
  {
    name: "Documentation",
    href: "https://docs.cal.com/docs/platform",
    icon: "chart-bar",
    target: "_blank",
  },
  {
    name: "API reference",
    href: "https://api.cal.com/v2/docs#/",
    icon: "terminal",
    target: "_blank",
  },
  {
    name: "Atoms",
    href: "https://docs.cal.com/docs/platform#atoms",
    icon: "atom",
    target: "_blank",
  },
  {
    name: MORE_SEPARATOR_NAME,
    href: "https://docs.cal.com/docs/platform/faq",
    icon: "ellipsis",
    target: "_blank",
  },
  {
    name: "Billing",
    href: "/settings/platform/billing",
    icon: "credit-card",
    moreOnMobile: true,
  },
  {
    name: "Members",
    href: "/settings/platform/members",
    icon: "users",
    moreOnMobile: true,
  },
];

const useNavigationItems = (isPlatformNavigation = false, isAdmin: boolean) => {
  const orgBranding = useOrgBranding();
  return useMemo(() => {
    const items = !isPlatformNavigation ? getNavigationItems(orgBranding) : platformNavigationItems;

    const desktopNavigationItems = items.filter(
      (item) => item.name !== MORE_SEPARATOR_NAME && (isAdmin || item.onlyAdmin == isAdmin)
    );
    const mobileNavigationBottomItems = items.filter(
      (item) => (isAdmin || item.onlyAdmin == isAdmin) && !item.moreOnMobile && !item.onlyDesktop
    );
    const mobileNavigationMoreItems = items.filter(
      (item) =>
        item.moreOnMobile &&
        !item.onlyDesktop &&
        item.name !== MORE_SEPARATOR_NAME &&
        (isAdmin || item.onlyAdmin == isAdmin)
    );

    return { desktopNavigationItems, mobileNavigationBottomItems, mobileNavigationMoreItems };
  }, [isPlatformNavigation, orgBranding]);
};

export const Navigation = ({
  isPlatformNavigation = false,
  isAdmin,
}: {
  isPlatformNavigation?: boolean;
  isAdmin: boolean;
}) => {
  const { desktopNavigationItems } = useNavigationItems(isPlatformNavigation, isAdmin);

  return (
    <nav className="mt-2 flex-1 md:px-2 lg:mt-4 lg:px-0">
      {desktopNavigationItems.map((item) => (
        <NavigationItem key={item.name} item={item} />
      ))}
      <div className="text-subtle mt-0.5 lg:hidden">
        <KBarTrigger />
      </div>
    </nav>
  );
};

export function MobileNavigationContainer({
  isPlatformNavigation = false,
}: {
  isPlatformNavigation?: boolean;
}) {
  const { status } = useSession();
  if (status !== "authenticated") return null;
  return <MobileNavigation isPlatformNavigation={isPlatformNavigation} />;
}

const MobileNavigation = ({ isPlatformNavigation = false }: { isPlatformNavigation?: boolean }) => {
  const isEmbed = useIsEmbed();
  const isAdmin = false;

  const { mobileNavigationBottomItems } = useNavigationItems(isPlatformNavigation, isAdmin);

  return (
    <>
      <nav
        className={classNames(
          "pwa:pb-[max(0.25rem,env(safe-area-inset-bottom))] pwa:-mx-2 bg-muted border-subtle fixed bottom-0 left-0 z-30 flex w-full border-t bg-opacity-40 px-1 shadow backdrop-blur-md md:hidden",
          isEmbed && "hidden"
        )}>
        {mobileNavigationBottomItems.map((item) => (
          <MobileNavigationItem key={item.name} item={item} />
        ))}
      </nav>
      {/* add padding to content for mobile navigation*/}
      <div className="block pt-12 md:hidden" />
    </>
  );
};

export const MobileNavigationMoreItems = () => {
  const isAdmin = false;
  const { mobileNavigationMoreItems } = useNavigationItems(false, isAdmin);

  return (
    <ul className="border-subtle mt-2 rounded-md border">
      {mobileNavigationMoreItems.map((item) => (
        <MobileNavigationMoreItem key={item.name} item={item} />
      ))}
    </ul>
  );
};
