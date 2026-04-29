"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

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
import { generateCardsWithAi } from "@/app/actions/ai";

type ButtonSize = "default" | "sm" | "lg";

const MIN_CARD_COUNT = 1;
const MAX_CARD_COUNT = 50;
const DEFAULT_CARD_COUNT = 20;

type GenerateCardsButtonProps = {
  deckId: number;
  hasAiFeature: boolean;
  hasAiContext: boolean;
  aiRemaining: number;
  totalRemaining: number;
  isPro: boolean;
  size?: ButtonSize;
  className?: string;
};

export function GenerateCardsButton({
  deckId,
  hasAiFeature,
  hasAiContext,
  aiRemaining,
  totalRemaining,
  isPro,
  size = "default",
  className,
}: GenerateCardsButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const maxAllowed = Math.min(MAX_CARD_COUNT, aiRemaining, totalRemaining);
  const initialCount = Math.max(
    MIN_CARD_COUNT,
    Math.min(maxAllowed, DEFAULT_CARD_COUNT),
  );
  const [count, setCount] = React.useState<number>(initialCount);

  React.useEffect(() => {
    if (open) setCount(initialCount);
  }, [open, initialCount]);

  if (!hasAiFeature) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href="/pricing"
              className={cn(buttonVariants({ size }), className)}
              aria-label="Generate cards with AI (paid feature)"
            >
              <Sparkles />
              Generate cards with AI
            </Link>
          }
        />
        <TooltipContent>
          AI flashcard generation is a Pro feature. Click to upgrade.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!hasAiContext) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-disabled="true"
              onClick={(event) => {
                event.preventDefault();
                toast.info(
                  "Add a description or attach a PDF so the AI knows what to generate.",
                );
              }}
              className={cn(
                buttonVariants({ size }),
                "cursor-not-allowed opacity-50",
                className,
              )}
            >
              <Sparkles />
              Generate cards with AI
            </button>
          }
        />
        <TooltipContent>
          Add a description or attach a PDF before generating cards with AI.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (maxAllowed <= 0) {
    const reason =
      aiRemaining <= 0
        ? `You've reached the AI-generated card limit for this deck on the ${isPro ? "Pro" : "Free"} plan.`
        : `This deck has reached its total card limit on the ${isPro ? "Pro" : "Free"} plan.`;
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
              className={cn(
                buttonVariants({ size }),
                "cursor-not-allowed opacity-50",
                className,
              )}
            >
              <Sparkles />
              Generate cards with AI
            </button>
          }
        />
        <TooltipContent>
          {reason}
          {!isPro ? " Upgrade to Pro for higher limits." : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeCount = Math.max(
      MIN_CARD_COUNT,
      Math.min(maxAllowed, Math.trunc(count) || initialCount),
    );

    startTransition(async () => {
      try {
        const result = await generateCardsWithAi({
          deckId,
          count: safeCount,
        });
        toast.success(
          `Generated ${result.generated} card${result.generated === 1 ? "" : "s"} with AI.`,
        );
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size={size} className={className}>
            <Sparkles />
            Generate cards with AI
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate cards with AI</DialogTitle>
          <DialogDescription>
            How many cards should we generate? Cards are based on this
            deck&apos;s title, description, and any attached source material.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-card-count">Number of cards</Label>
            <Input
              id="ai-card-count"
              type="number"
              inputMode="numeric"
              min={MIN_CARD_COUNT}
              max={maxAllowed}
              step={1}
              value={count}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                setCount(Number.isFinite(parsed) ? parsed : initialCount);
              }}
              required
              autoFocus
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              Between {MIN_CARD_COUNT} and {maxAllowed} (per-call max{" "}
              {MAX_CARD_COUNT}).
            </p>
            <p className="text-xs text-muted-foreground">
              {aiRemaining} AI slot{aiRemaining === 1 ? "" : "s"} and{" "}
              {totalRemaining} total slot{totalRemaining === 1 ? "" : "s"}{" "}
              remaining in this deck on the {isPro ? "Pro" : "Free"} plan.
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {pending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
