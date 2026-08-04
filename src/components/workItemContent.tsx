import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import type { WorkItemAttachment, WorkItemContentBlock } from "../types";
import type { WorkItemProduct } from "../types";
import { resolveWorkItemAttachmentUrl, uploadWorkItemAttachment } from "../lib/workItemsStore";
import {
  formatAttachmentSize,
  validateWorkItemAttachment,
} from "../lib/workItemFiles";
import { PIcon } from "./icons";
import { inputCls } from "./ui";

export type DraftWorkItemContentBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; storagePath?: string; name: string; file?: File; previewUrl?: string }
  | { id: string; type: "file"; storagePath?: string; name: string; contentType: string; size: number; file?: File };

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
    if (block.type === "image" && block.storagePath) {
      saved.push({ id: block.id, type: "image", storagePath: block.storagePath, name: block.name });
    } else if (block.type === "file" && block.storagePath) {
      saved.push({
        id: block.id,
        type: "file",
        storagePath: block.storagePath,
        name: block.name,
        contentType: block.contentType,
        size: block.size,
      });
    } else if (block.file) {
      const uploaded = await uploadWorkItemAttachment(workItemId, product, block.file);
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
    resolveWorkItemAttachmentUrl(storagePath)
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

function StoredFile({ block, compact = false }: { block: Extract<WorkItemContentBlock, { type: "file" }>; compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    resolveWorkItemAttachmentUrl(block.storagePath)
      .then((next) => live && setUrl(next))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [block.storagePath]);

  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-lg border border-line bg-paper ${compact ? "p-3 pr-12" : "p-4"}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-deep">
        <PIcon name="paperclip" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{block.name}</span>
        <span className="block text-xs text-muted">{formatAttachmentSize(block.size)}</span>
      </span>
      {failed ? (
        <span className="text-xs font-semibold text-danger">Unavailable</span>
      ) : url ? (
        <a className="shrink-0 text-xs font-semibold text-gold-deep hover:underline" href={url} target="_blank" rel="noreferrer">
          Download
        </a>
      ) : (
        <span className="h-3 w-14 animate-pulse rounded bg-tone" />
      )}
    </div>
  );
}

export function WorkItemAttachmentList({ attachments, compact = false }: { attachments: WorkItemAttachment[]; compact?: boolean }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex min-w-0 flex-col gap-2">
      {attachments.map((attachment) => attachment.type === "image" ? (
        <StoredImage key={attachment.id} storagePath={attachment.storagePath} name={attachment.name} className={compact ? "max-h-64" : ""} />
      ) : (
        <StoredFile key={attachment.id} block={attachment} compact={compact} />
      ))}
    </div>
  );
}

export function WorkItemDetailsEditor({
  blocks,
  onChange,
}: {
  blocks: DraftWorkItemContentBlock[];
  onChange: (blocks: DraftWorkItemContentBlock[]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

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

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    setAttachmentError(null);
    const inserted: DraftWorkItemContentBlock[] = [];
    try {
      for (const file of files) {
        const type = validateWorkItemAttachment(file);
        if (type === "image") {
          inserted.push({
            id: blockId(),
            type: "image",
            name: file.name || "Attached image",
            file,
            previewUrl: URL.createObjectURL(file),
          });
        } else {
          inserted.push({
            id: blockId(),
            type: "file",
            name: file.name || "Attached file",
            contentType: file.type,
            size: file.size,
            file,
          });
        }
      }
      onChange([...blocks, ...inserted]);
    } catch (reason) {
      inserted.forEach((block) => {
        if (block.type === "image" && block.previewUrl) URL.revokeObjectURL(block.previewUrl);
      });
      setAttachmentError(reason instanceof Error ? reason.message : "Unable to attach this file.");
    }
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
        Write the steps, paste screenshots, or attach supporting files.
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
          ) : block.type === "image" ? (
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
          ) : (
            <div key={block.id} className="relative">
              {block.storagePath ? (
                <StoredFile block={{ ...block, storagePath: block.storagePath }} compact />
              ) : (
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-paper p-3 pr-12">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-deep">
                    <PIcon name="paperclip" size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{block.name}</span>
                    <span className="block text-xs text-muted">{formatAttachmentSize(block.size)}</span>
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeBlock(index)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper text-danger shadow-sm hover:bg-danger-soft"
                title="Remove file"
              >
                <PIcon name="x" size={13} sw={2.2} />
              </button>
            </div>
          ),
        )}
        {attachmentError && <p className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">{attachmentError}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <input ref={fileInput} className="hidden" type="file" multiple onChange={handleFiles} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-deep hover:underline"
          >
            <PIcon name="paperclip" size={13} />
            Attach file
          </button>
          <button
            type="button"
            onClick={() => onChange([...blocks, { id: blockId(), type: "text", text: "" }])}
            className="text-xs font-semibold text-gold-deep hover:underline"
          >
            + Add another text step
          </button>
        </div>
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
        ) : block.type === "image" ? (
          <StoredImage key={block.id} storagePath={block.storagePath} name={block.name} />
        ) : (
          <StoredFile key={block.id} block={block} />
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
