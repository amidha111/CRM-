import { Avatar } from "./ui";

export type Page = "opportunities" | "activity" | "dashboard" | "settings";

const NAV: { key: Page; label: string; icon: string }[] = [
  { key: "opportunities", label: "Opportunities", icon: "◎" },
  { key: "activity", label: "Activity Log", icon: "↺" },
  { key: "dashboard", label: "Dashboard", icon: "▦" },
  { key: "settings", label: "Settings", icon: "⚙" },
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
  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col bg-navy text-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-lg font-extrabold text-navy">
          D
        </span>
        <span className="text-lg font-bold tracking-tight">Darma Foundry</span>
      </div>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = item.key === page;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                active
                  ? "border-l-2 border-gold bg-white/10 text-gold"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span aria-hidden className="w-4 text-center">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={userName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <button onClick={onSignOut} className="text-xs text-white/50 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
