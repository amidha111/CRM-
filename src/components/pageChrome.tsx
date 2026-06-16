import type { ReactNode } from "react";
import { PIcon, type IconName } from "./icons";

export function PageHeader({
  icon,
  kind,
  title,
  meta,
  actions,
}: {
  icon: IconName;
  kind: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <span className="object-tile">
        <PIcon name={icon} size={21} sw={1.9} />
      </span>
      <div>
        <div className="page-kind">{kind}</div>
        <div className="page-title-row">
          <h1>{title}</h1>
          <PIcon name="chevronDown" size={16} className="text-faint" />
          <PIcon name="star" size={15} className="text-gold" />
        </div>
      </div>
      {meta && <span className="page-meta">{meta}</span>}
      <span className="min-w-0 flex-1" />
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
