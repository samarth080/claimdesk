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
    <header className="border-b border-zinc-200 border-t-[3px] border-t-[#f37021] bg-white shadow-[0_2px_12px_rgba(24,24,27,0.05)]">
      <div className={`mx-auto flex ${widthClass} flex-col items-stretch justify-between gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-5 sm:px-8`}>
        <Link href="/" aria-label="ClaimDesk intake" className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-md font-mono text-mini font-bold text-white shadow-sm">
            <span className="flex w-7 items-center justify-center bg-[#f37021]">C</span>
            <span className="flex w-7 items-center justify-center bg-[#0b5fc6]">D</span>
          </span>
          <span className="min-w-0">
            <span className="block text-lead font-extrabold tracking-[-0.035em]">
              <span className="text-[#f37021]">CLAIM</span>
              <span className="text-[#0b5fc6]">DESK</span>
            </span>
            <span className="block truncate text-micro font-medium text-zinc-500">{subtitle}</span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="grid w-full grid-cols-4 items-center gap-1 rounded-lg bg-zinc-100 p-1 sm:flex sm:w-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            const activeClass =
              item.key === "agent"
                ? "bg-[#0b5fc6] text-white shadow-sm"
                : "bg-[#f37021] text-white shadow-sm";

            return isActive ? (
              <span
                key={item.key}
                aria-current="page"
                className={`rounded-md px-2 py-2 text-center text-mini font-semibold sm:px-3 sm:text-detail ${activeClass}`}
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-md px-2 py-2 text-center text-mini font-semibold text-zinc-600 transition hover:bg-white hover:text-zinc-950 sm:px-3 sm:text-detail"
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
