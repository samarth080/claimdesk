import Link from "next/link";

type AppHeaderProps = {
  active: "intake" | "demo" | "agent" | "impact";
  subtitle: string;
  maxWidth?: "wide" | "standard";
};

const NAV_ITEMS = [
  { key: "intake", href: "/", label: "Claim intake" },
  { key: "demo", href: "/demo", label: "Demo" },
  { key: "agent", href: "/agent", label: "Agent queue" },
  { key: "impact", href: "/impact", label: "Impact" },
] as const;

export function AppHeader({ active, subtitle, maxWidth = "standard" }: AppHeaderProps) {
  const widthClass = maxWidth === "wide" ? "max-w-[1440px]" : "max-w-[1280px]";

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className={`mx-auto flex ${widthClass} flex-col items-stretch justify-between gap-3 px-5 py-3 sm:flex-row sm:items-center sm:gap-5 sm:px-8`}>
        <Link
          href="/"
          aria-label="ClaimDesk intake"
          className="group flex min-w-0 items-center gap-2.5 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f37021]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f37021] font-display text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(243,112,33,0.35)] transition group-hover:scale-105">
            C
          </span>
          <span className="min-w-0">
            <span className="block font-display text-title font-bold leading-none tracking-[-0.045em]">
              <span className="text-[#f37021]">CLAIM</span>
              <span className="text-[#0b5fc6]">DESK</span>
            </span>
            <span className="mt-1 block truncate text-micro font-medium text-zinc-500">
              {subtitle}
            </span>
          </span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="grid w-full grid-cols-4 items-center gap-1 rounded-full bg-zinc-100/90 p-1 sm:flex sm:w-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            const activeClass =
              item.key === "agent"
                ? "bg-[#0b5fc6] text-white shadow-[0_4px_12px_rgba(11,95,198,0.32)]"
                : "bg-[#f37021] text-white shadow-[0_4px_12px_rgba(243,112,33,0.32)]";

            return isActive ? (
              <span
                key={item.key}
                aria-current="page"
                className={`rounded-full px-2 py-2 text-center text-mini font-semibold sm:px-4 sm:text-detail ${activeClass}`}
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-full px-2 py-2 text-center text-mini font-semibold text-zinc-600 transition hover:bg-white hover:text-zinc-950 hover:shadow-sm sm:px-4 sm:text-detail"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
