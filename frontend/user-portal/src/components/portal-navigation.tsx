"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  Landmark,
  Menu,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type PortalLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const portalLinks: PortalLink[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/accounts",
    label: "Accounts",
    description: "Balances and payees",
    icon: WalletCards,
  },
  {
    href: "/cards",
    label: "Cards",
    description: "Debit and credit controls",
    icon: CreditCard,
  },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function PortalNavigation() {
  const pathname = usePathname();

  return (
    <>
      <nav
        className="enterprise-nav hidden md:flex"
        aria-label="Customer portal navigation"
      >
        {portalLinks.map((link) => {
          const Icon = link.icon;
          const isActive = isActivePath(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className="enterprise-nav-link"
              data-active={isActive}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-4" aria-hidden />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="enterprise-mobile-trigger md:hidden"
            aria-label="Open customer navigation"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[20rem] max-w-[calc(100vw-2rem)] gap-0 p-0"
        >
          <SheetHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
                <Landmark className="size-5" aria-hidden />
              </div>
              <div>
                <SheetTitle>Nexus Banking</SheetTitle>
                <SheetDescription>Customer workspace</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <nav
            className="grid gap-1 p-3"
            aria-label="Customer mobile navigation"
          >
            {portalLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isActivePath(pathname, link.href);

              return (
                <SheetClose asChild key={link.href}>
                  <Link
                    href={link.href}
                    className="enterprise-drawer-link"
                    data-active={isActive}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="grid gap-0.5">
                      <span className="text-sm font-semibold">
                        {link.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {link.description}
                      </span>
                    </span>
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
