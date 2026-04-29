"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bytesToMb } from "@/lib/billing";
import {
  addDeckAttachment,
  removeDeckAttachment,
} from "@/app/actions/attachments";

const ALLOWED_MIME = "application/pdf";

export type DeckAttachmentItem = {
  id: number;
  filename: string;
  byteSize: number;
};

type DeckAttachmentsProps = {
  deckId: number;
  attachments: DeckAttachmentItem[];
  maxBytes: number;
  maxPerDeck: number;
  isPro: boolean;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

export function DeckAttachments({
  deckId,
  attachments,
  maxBytes,
  maxPerDeck,
  isPro,
}: DeckAttachmentsProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<number | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const atLimit = attachments.length >= maxPerDeck;
  const busy = uploading || removingId !== null;
  const maxMb = bytesToMb(maxBytes);
  const planName = isPro ? "Pro" : "Free";

  async function uploadFile(file: File) {
    if (file.type !== ALLOWED_MIME) {
      toast.error("Only PDF files are supported.");
      return;
    }
    if (file.size === 0) {
      toast.error("That file is empty.");
      return;
    }
    if (file.size > maxBytes) {
      toast.error(
        `${file.name} is too large. ${planName} plan limit is ${maxMb} MB per file.`,
      );
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      await addDeckAttachment({
        deckId,
        filename: file.name.slice(0, 255),
        mimeType: file.type,
        byteSize: file.size,
        base64,
      });
      toast.success(`Added ${file.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not upload ${file.name}.`,
      );
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (atLimit) {
      toast.error(
        `This deck already has the maximum of ${maxPerDeck} attachments on the ${planName} plan.`,
      );
      return;
    }
    const remaining = maxPerDeck - attachments.length;
    const accepted = list.slice(0, remaining);
    const rejected = list.length - accepted.length;
    if (rejected > 0) {
      toast.error(
        `Only ${remaining} more attachment${remaining === 1 ? "" : "s"} fit in this deck on the ${planName} plan. Skipping ${rejected} file${rejected === 1 ? "" : "s"}.`,
      );
    }
    setUploading(true);
    try {
      for (const file of accepted) {
        await uploadFile(file);
      }
    } finally {
      setUploading(false);
      router.refresh();
    }
  }

  async function handleRemove(attachmentId: number, filename: string) {
    setRemovingId(attachmentId);
    try {
      await removeDeckAttachment({ attachmentId, deckId });
      toast.success(`Removed ${filename}.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove file.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-sm font-medium">
            AI source material
          </h3>
          <p className="text-xs text-muted-foreground">
            Attach PDFs to ground AI-generated cards in your own material. Up
            to {maxPerDeck} file{maxPerDeck === 1 ? "" : "s"}, {maxMb} MB each
            on the {planName} plan.
            {!isPro ? " Upgrade to Pro for higher limits." : ""}
          </p>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          if (atLimit || busy) return;
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          if (atLimit || busy) return;
          if (event.dataTransfer.files.length > 0) {
            void handleFiles(event.dataTransfer.files);
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center transition-colors",
          isDragOver && "border-foreground/40 bg-muted/40",
          (atLimit || busy) && "opacity-60",
        )}
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm">
            {uploading
              ? "Uploading and reading PDF..."
              : atLimit
                ? `You've reached the limit of ${maxPerDeck} attachments on the ${planName} plan.`
                : "Drag PDFs here, or click to choose."}
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, up to {maxMb} MB each.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atLimit || busy}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          Choose PDFs
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              void handleFiles(event.target.files);
            }
            event.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {attachments.map((att) => {
            const isRemoving = removingId === att.id;
            return (
              <li
                key={att.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {att.filename}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(att.byteSize)}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${att.filename}`}
                  disabled={busy}
                  onClick={() => handleRemove(att.id, att.filename)}
                >
                  {isRemoving ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
