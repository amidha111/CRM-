import { useState } from "react";
import { Avatar } from "./ui";
import { PIcon, type IconName } from "./icons";

export type Page = "opportunities" | "accounts" | "contacts" | "activity" | "dashboard" | "settings";

const NAV: { key: Page; label: string; icon: IconName }[] = [
  { key: "dashboard", label: "Dashboard", icon: "chart" },
  { key: "opportunities", label: "Opportunities", icon: "target" },
  { key: "accounts", label: "Accounts", icon: "briefcase" },
  { key: "contacts", label: "Contacts", icon: "users" },
  { key: "activity", label: "Activity", icon: "activity" },
  { key: "settings", label: "Settings", icon: "sliders" },
];

export function Sidebar({
  page,
  onNavigate,
  userName,
  onSignOut,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  userName: string;
  onSignOut: () => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="shrink-0">
      <div className="topbar">
        <div className="flex items-center gap-[11px]">
          <span className="brand-mark">D</span>
          <span className="text-[15.5px] font-bold tracking-[-0.01em]">Darma Foundry</span>
          <span className="h-[22px] w-px bg-white/15" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-gold-bright/80">SALES</span>
        </div>
        <div className="global-search">
          <PIcon name="search" size={15} />
          <span className="truncate">Search opportunities, accounts, contacts...</span>
          <span className="ml-auto rounded border border-white/15 px-1.5 py-px font-mono text-[10px] text-white/40">⌘K</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="relative flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-white/7 text-white/65">
            <PIcon name="bell" size={17} />
            <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full border border-navy bg-gold-bright" />
          </button>
          <button type="button" className="hidden h-[34px] w-[34px] items-center justify-center rounded-lg text-white/65 hover:bg-white/7 sm:flex">
            <PIcon name="sliders" size={17} />
          </button>
          <button type="button" className="hidden h-[34px] w-[34px] items-center justify-center rounded-lg text-white/65 hover:bg-white/7 sm:flex">
            <PIcon name="help" size={17} />
          </button>
          <div className="relative ml-2">
            <button
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-full bg-white/6 py-1 pr-2 pl-1 text-sm font-semibold text-white hover:bg-white/10"
              title={`Signed in as ${userName}`}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <Avatar name={userName} size={27} />
              <span className="hidden sm:inline">{userName}</span>
              <PIcon
                name="chevronDown"
                size={14}
                className={`text-white/45 transition ${userMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-lg border border-line bg-paper py-1.5 text-ink shadow-xl" role="menu">
                <div className="border-b border-line-soft px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Signed in</p>
                  <p className="truncate text-sm font-semibold">{userName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigate("settings");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-gold-soft hover:text-ink"
                  role="menuitem"
                >
                  <PIcon name="sliders" size={15} />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft"
                  role="menuitem"
                >
                  <PIcon name="logOut" size={15} sw={2} />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <nav className="object-tabs">
        {NAV.map((item) => {
          const active = item.key === page;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`object-tab ${active ? "on" : ""}`}
            >
              <PIcon name={item.icon} size={15} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
