import { useEffect, useState, type ClipboardEvent } from "react";
import type { WorkItemContentBlock } from "../types";
import type { WorkItemProduct } from "../types";
import { resolveWorkItemImageUrl, uploadWorkItemImage } from "../lib/workItemsStore";
import { PIcon } from "./icons";
import { inputCls } from "./ui";

export type DraftWorkItemContentBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; storagePath?: string; name: string; file?: File; previewUrl?: string };

function blockId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function draftContent(content?: WorkItemContentBlock[]): DraftWorkItemContentBlock[] {
  if (!content?.length) return [{ id: blockId(), type: "text", text: "" }];
  return content.map((block) => ({ ...block }));
}

export async function saveDraftContent(
  workItemId: string,
  blocks: DraftWorkItemContentBlock[],
  product: WorkItemProduct,
): Promise<WorkItemContentBlock[]> {
  const saved: WorkItemContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (block.text.trim()) saved.push({ id: block.id, type: "text", text: block.text.trim() });
      continue;
    }
    if (block.storagePath) {
      saved.push({ id: block.id, type: "image", storagePath: block.storagePath, name: block.name });
    } else if (block.file) {
      const uploaded = await uploadWorkItemImage(workItemId, product, block.file);
      saved.push({ ...uploaded, id: block.id });
    }
  }
  return saved;
}

function StoredImage({ storagePath, name, className = "" }: { storagePath: string; name: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    resolveWorkItemImageUrl(storagePath)
      .then((next) => live && setUrl(next))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [storagePath]);

  if (failed) return <p className="rounded-md border border-danger/20 bg-danger-soft p-3 text-sm text-danger">Unable to load {name}.</p>;
  if (!url) return <div className={`animate-pulse rounded-lg bg-tone ${className || "h-48"}`} />;
  return <img src={url} alt={name} decoding="async" className={`block h-auto max-h-[560px] w-auto max-w-full rounded-lg border border-line object-contain ${className}`} />;
}

export function WorkItemDetailsEditor({
  blocks,
  onChange,
}: {
  blocks: DraftWorkItemContentBlock[];
  onChange: (blocks: DraftWorkItemContentBlock[]) => void;
}) {
  function updateText(index: number, text: string) {
    onChange(blocks.map((block, i) => (i === index && block.type === "text" ? { ...block, text } : block)));
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLTextAreaElement>) {
    const images = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    event.preventDefault();
    const inserted: DraftWorkItemContentBlock[] = [];
    for (const file of images) {
      inserted.push({
        id: blockId(),
        type: "image",
        name: file.name || "Pasted image",
        file,
        previewUrl: URL.createObjectURL(file),
      });
      inserted.push({ id: blockId(), type: "text", text: "" });
    }
    onChange([...blocks.slice(0, index + 1), ...inserted, ...blocks.slice(index + 1)]);
  }

  function removeBlock(index: number) {
    const removed = blocks[index];
    if (removed.type === "image" && removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    const next = blocks.filter((_, i) => i !== index);
    onChange(next.length ? next : [{ id: blockId(), type: "text", text: "" }]);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-tone/40">
      <div className="flex items-center gap-2 border-b border-line bg-paper px-3 py-2 text-xs text-muted">
        <PIcon name="note" size={14} />
        Write the steps and paste screenshots directly into any text box.
      </div>
      <div className="flex flex-col gap-3 p-3">
        {blocks.map((block, index) =>
          block.type === "text" ? (
            <textarea
              key={block.id}
              className={`${inputCls} min-h-24 resize-y bg-paper`}
              placeholder={index === 0 ? "Explain the issue or feature in detail…" : "Continue with the next step…"}
              value={block.text}
              onChange={(event) => updateText(index, event.target.value)}
              onPaste={(event) => handlePaste(index, event)}
            />
          ) : (
            <div key={block.id} className="relative rounded-lg border border-line bg-paper p-3">
              {block.previewUrl ? (
                <img src={block.previewUrl} alt={block.name} className="max-h-80 w-auto max-w-full rounded-md object-contain" />
              ) : block.storagePath ? (
                <StoredImage storagePath={block.storagePath} name={block.name} className="max-h-80" />
              ) : null}
              <button
                type="button"
                onClick={() => removeBlock(index)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper text-danger shadow-sm hover:bg-danger-soft"
                title="Remove image"
              >
                <PIcon name="x" size={13} sw={2.2} />
              </button>
            </div>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange([...blocks, { id: blockId(), type: "text", text: "" }])}
          className="self-start text-xs font-semibold text-gold-deep hover:underline"
        >
          + Add another text step
        </button>
      </div>
    </div>
  );
}

export function WorkItemContent({ content }: { content: WorkItemContentBlock[] }) {
  if (!content.length) return <p className="text-sm text-muted">No details were provided.</p>;
  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
      {content.map((block) =>
        block.type === "text" ? (
          <p key={block.id} className="whitespace-pre-wrap text-sm leading-6 text-ink">
            {block.text}
          </p>
        ) : (
          <StoredImage key={block.id} storagePath={block.storagePath} name={block.name} />
        ),
      )}
    </div>
  );
}

export function videoEmbedUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname === "www.loom.com" || url.hostname === "loom.com") {
      const match = url.pathname.match(/^\/share\/([a-zA-Z0-9]+)/);
      return match ? `https://www.loom.com/embed/${match[1]}` : null;
    }
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}
