import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import AuthButton from "@/components/AuthButton";
import NavLinks from "@/components/NavLinks";
import { NavLinkList } from "@/components/NavLinks";
import LogoIcon from "@/components/icons/LogoIcon";

export default function AppHeader() {
  return (
    <Disclosure as="header" className="border-b border-zinc-200">
      {/* Single row */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-16 sm:py-4">
        {/* Left: hamburger (mobile) + logo + nav (desktop) */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Mobile: hamburger — uses data-open from headlessui to swap icons */}
          <DisclosureButton className="group flex items-center justify-center rounded-md p-2 text-zinc-500 hover:text-zinc-900 sm:hidden">
            <Bars3Icon className="h-6 w-6 group-data-[open]:hidden" aria-hidden="true" />
            <XMarkIcon className="hidden h-6 w-6 group-data-[open]:block" aria-hidden="true" />
          </DisclosureButton>

          {/* Logo */}
          <a href="/" className="flex items-center gap-2 text-xl sm:text-3xl font-semibold tracking-tight text-black">
            <LogoIcon className="h-6 sm:h-8 w-auto" />
            Вікіархіватор
          </a>

          {/* Desktop nav links */}
          <div className="hidden sm:block">
            <NavLinks />
          </div>
        </div>

        {/* Right: auth (desktop only) */}
        <div className="hidden sm:block">
          <AuthButton />
        </div>
      </div>

      {/* Mobile panel */}
      <DisclosurePanel className="flex flex-col gap-4 border-t border-zinc-100 px-4 py-4 sm:hidden">
        <NavLinkList />
        <div className="border-t border-zinc-100 pt-2">
          <AuthButton />
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
