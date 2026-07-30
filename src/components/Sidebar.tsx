import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { Avatar } from "./ui";
import { PIcon, type IconName } from "./icons";

export type Page = "opportunities" | "accounts" | "contacts" | "activity" | "dashboard" | "workItems" | "settings";

const NAV: { key: Page; label: string; icon: IconName }[] = [
  { key: "dashboard", label: "Dashboard", icon: "chart" },
  { key: "workItems", label: "Work Items", icon: "note" },
  { key: "opportunities", label: "Opportunities", icon: "target" },
  { key: "accounts", label: "Accounts", icon: "briefcase" },
  { key: "contacts", label: "Contacts", icon: "users" },
  { key: "activity", label: "Activity", icon: "activity" },
  { key: "settings", label: "Settings", icon: "sliders" },
];

const DEFAULT_TAB_ORDER = NAV.map((item) => item.key);

function storageKey(userKey: string): string {
  return `plan-clarity:top-tab-order:${userKey.trim().toLowerCase() || "anonymous"}`;
}

function storedTabOrder(userKey: string): Page[] {
  if (typeof window === "undefined") return DEFAULT_TAB_ORDER;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userKey)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_TAB_ORDER;
    const valid = parsed.filter((key): key is Page => typeof key === "string" && DEFAULT_TAB_ORDER.includes(key as Page));
    const unique = [...new Set(valid)];
    return [...unique, ...DEFAULT_TAB_ORDER.filter((key) => !unique.includes(key))];
  } catch {
    return DEFAULT_TAB_ORDER;
  }
}

export function Sidebar({
  page,
  onNavigate,
  userName,
  userKey,
  onSignOut,
  workItemsOnly = false,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  userName: string;
  userKey: string;
  onSignOut: () => void;
  workItemsOnly?: boolean;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tabOrder, setTabOrder] = useState<Page[]>(() => storedTabOrder(userKey));
  const [draggedTab, setDraggedTab] = useState<Page | null>(null);
  const [dropTarget, setDropTarget] = useState<Page | null>(null);

  useEffect(() => setTabOrder(storedTabOrder(userKey)), [userKey]);

  const orderedTabs = useMemo(
    () => tabOrder.map((key) => NAV.find((item) => item.key === key)).filter((item): item is (typeof NAV)[number] => !!item),
    [tabOrder],
  );

  function saveOrder(next: Page[]) {
    setTabOrder(next);
    try {
      window.localStorage.setItem(storageKey(userKey), JSON.stringify(next));
    } catch {
      // The current session can still be reordered when browser storage is unavailable.
    }
  }

  function dropTab(target: Page, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!draggedTab || draggedTab === target) return;
    const next = tabOrder.filter((key) => key !== draggedTab);
    const bounds = event.currentTarget.getBoundingClientRect();
    const placeAfter = event.clientX > bounds.left + bounds.width / 2;
    const targetIndex = next.indexOf(target);
    next.splice(targetIndex + (placeAfter ? 1 : 0), 0, draggedTab);
    saveOrder(next);
    setDraggedTab(null);
    setDropTarget(null);
  }

  function moveTabWithKeyboard(tab: Page, direction: -1 | 1, event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey) return;
    event.preventDefault();
    const index = tabOrder.indexOf(tab);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= tabOrder.length) return;
    const next = [...tabOrder];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    saveOrder(next);
  }

  return (
    <header className="shrink-0">
      <div className="topbar">
        <div className="flex items-center gap-[11px]">
          <span className="brand-mark">P</span>
          <span className="text-[15.5px] font-bold tracking-[-0.01em]">Plan Clarity</span>
          <span className="h-[22px] w-px bg-white/15" />
          <span className="font-mono text-[10px] tracking-[0.2em] text-gold-bright/80">{workItemsOnly ? "DELIVERY" : "SALES"}</span>
        </div>
        <div className="global-search">
          <PIcon name="search" size={15} />
          <span className="truncate">{workItemsOnly ? "Search work items..." : "Search opportunities, accounts, contacts..."}</span>
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
                {!workItemsOnly && <button
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
                </button>}
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
        {orderedTabs.filter((item) => !workItemsOnly || item.key === "workItems").map((item) => {
          const active = item.key === page;
          return (
            <button
              data-preview-allow
              key={item.key}
              draggable={!workItemsOnly}
              onClick={() => onNavigate(item.key)}
              onDragStart={(event) => {
                setDraggedTab(item.key);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.key);
              }}
              onDragEnter={() => setDropTarget(item.key)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => dropTab(item.key, event)}
              onDragEnd={() => {
                setDraggedTab(null);
                setDropTarget(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") moveTabWithKeyboard(item.key, -1, event);
                if (event.key === "ArrowRight") moveTabWithKeyboard(item.key, 1, event);
              }}
              className={`object-tab ${active ? "on" : ""} ${!workItemsOnly ? "cursor-grab active:cursor-grabbing" : ""} ${draggedTab === item.key ? "opacity-45" : ""} ${dropTarget === item.key && draggedTab !== item.key ? "bg-gold-soft/70" : ""}`}
              title={workItemsOnly ? item.label : `${item.label} · drag to reorder · Option/Alt + arrow keys`}
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
