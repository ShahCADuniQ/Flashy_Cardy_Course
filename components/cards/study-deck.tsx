"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  generateCardsWithAi,
  generateOneCardWithAi,
} from "@/app/actions/ai";

type StudyCard = {
  id: number;
  front: string;
  back: string;
};

type StudyDeckProps = {
  deckId: number;
  cards: StudyCard[];
  hasAiFeature: boolean;
  hasAiContext: boolean;
  aiRemaining: number;
  totalRemaining: number;
  isPro: boolean;
};

const MIN_CARD_COUNT = 1;
const MAX_CARD_COUNT = 50;
const DEFAULT_CARD_COUNT = 10;

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function StudyDeck({
  deckId,
  cards,
  hasAiFeature,
  hasAiContext,
  aiRemaining,
  totalRemaining,
  isPro,
}: StudyDeckProps) {
  const [order, setOrder] = React.useState<StudyCard[]>(cards);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [aiUsedThisSession, setAiUsedThisSession] = React.useState(0);

  const liveAiRemaining = Math.max(0, aiRemaining - aiUsedThisSession);
  const liveTotalRemaining = Math.max(0, totalRemaining - aiUsedThisSession);

  const total = order.length;
  const finished = index >= total;
  const current = finished ? null : order[index];
  const isLast = index === total - 1;
  const isFirst = index === 0;

  const goNext = React.useCallback(() => {
    if (finished) return;
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, total));
  }, [finished, total]);

  const goPrev = React.useCallback(() => {
    if (isFirst) return;
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, [isFirst]);

  const flip = React.useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const restart = React.useCallback(() => {
    setIndex(0);
    setFlipped(false);
  }, []);

  const shuffle = React.useCallback(() => {
    setOrder((prev) => shuffleArray(prev));
    setIndex(0);
    setFlipped(false);
  }, []);

  const appendCardsAndJump = React.useCallback(
    (newCards: StudyCard[]) => {
      if (newCards.length === 0) return;
      setOrder((prev) => {
        const next = [...prev, ...newCards];
        return next;
      });
      setIndex(order.length);
      setFlipped(false);
    },
    [order.length],
  );

  React.useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      if (finished) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        flip();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [finished, flip, goNext, goPrev]);

  const progress = total === 0 ? 0 : (Math.min(index, total) / total) * 100;
  const reviewedCount = Math.min(index, total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {finished
            ? `Reviewed ${reviewedCount} of ${total}`
            : `Card ${index + 1} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={shuffle}>
            <Shuffle />
            Shuffle
          </Button>
          <Button variant="ghost" size="sm" onClick={restart}>
            <RotateCcw />
            Restart
          </Button>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {finished ? (
        <FinishedView
          deckId={deckId}
          reviewedCount={reviewedCount}
          hasAiFeature={hasAiFeature}
          hasAiContext={hasAiContext}
          aiRemaining={liveAiRemaining}
          totalRemaining={liveTotalRemaining}
          isPro={isPro}
          onRestart={restart}
          onCardsAdded={(newCards) => {
            appendCardsAndJump(newCards);
            setAiUsedThisSession((n) => n + newCards.length);
          }}
        />
      ) : current ? (
        <button
          type="button"
          onClick={flip}
          aria-pressed={flipped}
          className="group relative flex min-h-[300px] w-full cursor-pointer items-center justify-center rounded-2xl border border-border bg-card p-8 text-center text-card-foreground shadow-sm ring-1 ring-foreground/5 transition-all hover:ring-foreground/15 sm:min-h-[360px] sm:p-12"
        >
          <div className="absolute top-4 left-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {flipped ? "Back" : "Front"}
          </div>
          <p
            className={cn(
              "max-w-2xl text-balance whitespace-pre-wrap text-2xl font-medium leading-snug sm:text-3xl",
              flipped && "text-primary",
            )}
          >
            {flipped ? current.back : current.front}
          </p>
          <div className="absolute bottom-4 text-xs text-muted-foreground">
            Click, tap, or press Space to flip
          </div>
        </button>
      ) : null}

      {!finished ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={isFirst}
            aria-label="Previous card"
          >
            <ArrowLeft />
            Previous
          </Button>
          <Button onClick={flip} variant="secondary">
            Flip
          </Button>
          <Button
            onClick={goNext}
            aria-label={isLast ? "Finish" : "Next card"}
          >
            {isLast ? "Finish" : "Next"}
            <ArrowRight />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FinishedView({
  deckId,
  reviewedCount,
  hasAiFeature,
  hasAiContext,
  aiRemaining,
  totalRemaining,
  isPro,
  onRestart,
  onCardsAdded,
}: {
  deckId: number;
  reviewedCount: number;
  hasAiFeature: boolean;
  hasAiContext: boolean;
  aiRemaining: number;
  totalRemaining: number;
  isPro: boolean;
  onRestart: () => void;
  onCardsAdded: (cards: StudyCard[]) => void;
}) {
  const [oneCardPending, startOneCardTransition] = React.useTransition();
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [batchPending, startBatchTransition] = React.useTransition();

  const maxAllowed = Math.min(MAX_CARD_COUNT, aiRemaining, totalRemaining);
  const initialBatchCount = Math.max(
    MIN_CARD_COUNT,
    Math.min(maxAllowed, DEFAULT_CARD_COUNT),
  );
  const [batchCount, setBatchCount] =
    React.useState<number>(initialBatchCount);

  React.useEffect(() => {
    if (batchOpen) setBatchCount(initialBatchCount);
  }, [batchOpen, initialBatchCount]);

  const aiAvailable = hasAiFeature && hasAiContext;
  const aiBlockedReason = !hasAiFeature
    ? "AI flashcard generation is a Pro feature."
    : !hasAiContext
      ? "Add a description or attach a PDF before generating cards with AI."
      : null;
  const planName = isPro ? "Pro" : "Free";
  const limitReason =
    aiRemaining <= 0
      ? `You've reached the AI-generated card limit for this deck on the ${planName} plan.${
          isPro ? "" : " Upgrade to Pro for higher limits."
        }`
      : totalRemaining <= 0
        ? `This deck has reached its total card limit on the ${planName} plan.${
            isPro ? "" : " Upgrade to Pro for higher limits."
          }`
        : null;

  function handleAddOne() {
    startOneCardTransition(async () => {
      try {
        const result = await generateOneCardWithAi({ deckId });
        onCardsAdded([result.card]);
        toast.success("Added one card with AI.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  function handleBatchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeCount = Math.max(
      MIN_CARD_COUNT,
      Math.min(maxAllowed, Math.trunc(batchCount) || initialBatchCount),
    );

    startBatchTransition(async () => {
      try {
        const result = await generateCardsWithAi({
          deckId,
          count: safeCount,
        });
        onCardsAdded(result.cards);
        toast.success(
          `Generated ${result.cards.length} card${result.cards.length === 1 ? "" : "s"} with AI.`,
        );
        setBatchOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  const busy = oneCardPending || batchPending;

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center text-card-foreground shadow-sm ring-1 ring-foreground/5 sm:p-12">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground">
        <CheckCircle2 className="size-6" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          You&apos;ve reached the end
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {reviewedCount === 1
            ? "You reviewed 1 card."
            : `You reviewed ${reviewedCount} cards.`}
          {" "}Want to keep going? Generate more cards with AI, or restart to
          review again.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onRestart} variant="outline">
          <RotateCcw />
          Restart
        </Button>

        {aiBlockedReason ? (
          <>
            <AiBlockedButton
              label="Add 1 with AI"
              icon={<Plus />}
              reason={aiBlockedReason}
              hasAiFeature={hasAiFeature}
              variant="default"
            />
            <AiBlockedButton
              label="Add more with AI"
              icon={<Sparkles />}
              reason={aiBlockedReason}
              hasAiFeature={hasAiFeature}
              variant="default"
            />
          </>
        ) : limitReason ? (
          <>
            <AiBlockedButton
              label="Add 1 with AI"
              icon={<Plus />}
              reason={limitReason}
              hasAiFeature={hasAiFeature}
              variant="default"
            />
            <AiBlockedButton
              label="Add more with AI"
              icon={<Sparkles />}
              reason={limitReason}
              hasAiFeature={hasAiFeature}
              variant="default"
            />
          </>
        ) : (
          <>
            <Button onClick={handleAddOne} disabled={busy}>
              {oneCardPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus />
              )}
              {oneCardPending ? "Adding..." : "Add 1 with AI"}
            </Button>

            <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
              <DialogTrigger
                render={
                  <Button type="button" disabled={busy}>
                    <Sparkles />
                    Add more with AI
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate more cards with AI</DialogTitle>
                  <DialogDescription>
                    How many additional cards should we generate? They&apos;ll
                    be added to the deck and you&apos;ll continue studying with
                    them.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={handleBatchSubmit}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="study-batch-count">Number of cards</Label>
                    <Input
                      id="study-batch-count"
                      type="number"
                      inputMode="numeric"
                      min={MIN_CARD_COUNT}
                      max={maxAllowed}
                      step={1}
                      value={batchCount}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        setBatchCount(
                          Number.isFinite(parsed)
                            ? parsed
                            : initialBatchCount,
                        );
                      }}
                      required
                      autoFocus
                      disabled={batchPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Between {MIN_CARD_COUNT} and {maxAllowed} (per-call max{" "}
                      {MAX_CARD_COUNT}).
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {aiRemaining} AI slot{aiRemaining === 1 ? "" : "s"} and{" "}
                      {totalRemaining} total slot
                      {totalRemaining === 1 ? "" : "s"} remaining in this deck
                      on the {planName} plan.
                    </p>
                  </div>
                  <DialogFooter>
                    <DialogClose
                      render={<Button variant="outline" type="button" />}
                    >
                      Cancel
                    </DialogClose>
                    <Button type="submit" disabled={batchPending}>
                      {batchPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Sparkles />
                      )}
                      {batchPending ? "Generating..." : "Generate"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {!aiAvailable ? (
        <p className="max-w-md text-xs text-muted-foreground">
          {aiBlockedReason}
        </p>
      ) : limitReason ? (
        <p className="max-w-md text-xs text-muted-foreground">{limitReason}</p>
      ) : null}
    </div>
  );
}

function AiBlockedButton({
  label,
  icon,
  reason,
  hasAiFeature,
}: {
  label: string;
  icon: React.ReactNode;
  reason: string;
  hasAiFeature: boolean;
  variant?: "default" | "outline";
}) {
  if (!hasAiFeature) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href="/pricing"
              className={cn(buttonVariants())}
              aria-label={`${label} (paid feature)`}
            >
              <Sparkles />
              {icon}
              {label}
            </Link>
          }
        />
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-disabled="true"
            onClick={(event) => event.preventDefault()}
            className={cn(
              buttonVariants(),
              "cursor-not-allowed opacity-50",
            )}
          >
            <Sparkles />
            {icon}
            {label}
          </button>
        }
      />
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}
