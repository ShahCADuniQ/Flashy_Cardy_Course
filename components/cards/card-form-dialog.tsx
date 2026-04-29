"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCard, updateCard } from "@/app/actions/cards";
import { generateCardBackWithAi } from "@/app/actions/ai";

type CardFormDialogProps = {
  mode: "create" | "edit";
  deckId: number;
  hasAiFeature?: boolean;
  hasAiContext?: boolean;
  totalRemaining?: number;
  isPro?: boolean;
  card?: {
    id: number;
    front: string;
    back: string;
  };
  trigger?: React.ReactElement;
};

export function CardFormDialog({
  mode,
  deckId,
  hasAiFeature = false,
  hasAiContext = false,
  totalRemaining,
  isPro = false,
  card,
  trigger,
}: CardFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [aiPending, setAiPending] = React.useState(false);
  const [front, setFront] = React.useState(card?.front ?? "");
  const [back, setBack] = React.useState(card?.back ?? "");

  React.useEffect(() => {
    if (open) {
      setFront(card?.front ?? "");
      setBack(card?.back ?? "");
    }
  }, [open, card?.front, card?.back]);

  const isEdit = mode === "edit";
  const aiAvailable = hasAiFeature && hasAiContext;
  const deckFull =
    !isEdit && totalRemaining !== undefined && totalRemaining <= 0;

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="icon-sm" aria-label="Edit card">
      <Pencil />
    </Button>
  ) : (
    <Button>
      <Plus />
      Add card
    </Button>
  );

  if (deckFull) {
    const reason = `This deck has reached its ${isPro ? "Pro" : "Free"} plan card limit.${
      isPro ? "" : " Upgrade to Pro for higher limits."
    }`;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-disabled="true"
              onClick={(event) => {
                event.preventDefault();
                toast.info(reason);
              }}
              className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground opacity-50"
            >
              <Plus />
              Add card
            </button>
          }
        />
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    );
  }

  async function fillBackWithAi() {
    const trimmedFront = front.trim();
    if (!trimmedFront) {
      toast.error("Add a front first so the AI knows what to answer.");
      return null;
    }
    setAiPending(true);
    try {
      const result = await generateCardBackWithAi({
        deckId,
        front: trimmedFront,
      });
      setBack(result.back);
      return result.back;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not generate the back.",
      );
      return null;
    } finally {
      setAiPending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!front.trim()) {
      toast.error("Front is required");
      return;
    }

    let resolvedBack = back.trim();

    if (!resolvedBack) {
      if (!aiAvailable) {
        toast.error("Both sides are required");
        return;
      }
      const aiBack = await fillBackWithAi();
      if (!aiBack) return;
      resolvedBack = aiBack.trim();
      if (!resolvedBack) {
        toast.error("AI did not return a back. Please try again.");
        return;
      }
      toast.success("Filled the back with AI.");
    }

    startTransition(async () => {
      try {
        if (isEdit && card) {
          await updateCard({
            cardId: card.id,
            deckId,
            front: front.trim(),
            back: resolvedBack,
          });
          toast.success("Card updated");
        } else {
          await createCard({
            deckId,
            front: front.trim(),
            back: resolvedBack,
          });
          toast.success("Card added");
        }
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  const aiButtonReason = !hasAiFeature
    ? "AI flashcard generation is a Pro feature."
    : !hasAiContext
      ? "Add a description or attach a PDF before using AI."
      : !front.trim()
        ? "Type the front of the card first."
        : null;

  const busy = pending || aiPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit card" : "Add a new card"}
          </DialogTitle>
          <DialogDescription>
            The front is shown first while studying. The back is revealed when
            you flip the card.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="card-front">Front</Label>
            <Textarea
              id="card-front"
              value={front}
              onChange={(event) => setFront(event.target.value)}
              placeholder="e.g. Hello"
              maxLength={2000}
              rows={3}
              required
              autoFocus
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="card-back">Back</Label>
              {aiButtonReason ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-disabled="true"
                        onClick={(event) => event.preventDefault()}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-60 cursor-not-allowed"
                      >
                        <Sparkles className="size-3.5" />
                        Generate with AI
                      </button>
                    }
                  />
                  <TooltipContent>{aiButtonReason}</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  onClick={fillBackWithAi}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {aiPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {aiPending ? "Generating..." : "Generate with AI"}
                </button>
              )}
            </div>
            <Textarea
              id="card-back"
              value={back}
              onChange={(event) => setBack(event.target.value)}
              placeholder={
                aiAvailable
                  ? "e.g. Hola — or leave empty and we'll fill it in with AI when you save."
                  : "e.g. Hola"
              }
              maxLength={2000}
              rows={3}
              disabled={busy}
            />
            {aiAvailable ? (
              <p className="text-xs text-muted-foreground">
                Leave the back empty and we&apos;ll fill it in with AI when you
                save.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Add card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
