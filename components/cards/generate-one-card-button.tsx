"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { generateOneCardWithAi } from "@/app/actions/ai";

type ButtonSize = "default" | "sm" | "lg";

type GenerateOneCardButtonProps = {
  deckId: number;
  hasAiFeature: boolean;
  hasAiContext: boolean;
  aiRemaining: number;
  totalRemaining: number;
  isPro: boolean;
  size?: ButtonSize;
  className?: string;
};

export function GenerateOneCardButton({
  deckId,
  hasAiFeature,
  hasAiContext,
  aiRemaining,
  totalRemaining,
  isPro,
  size = "default",
  className,
}: GenerateOneCardButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (!hasAiFeature) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ variant: "outline", size }),
                className,
              )}
              aria-label="Generate one card with AI (paid feature)"
            >
              <Sparkles />
              <Plus />
              Add one with AI
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
                buttonVariants({ variant: "outline", size }),
                "cursor-not-allowed opacity-50",
                className,
              )}
            >
              <Sparkles />
              <Plus />
              Add one with AI
            </button>
          }
        />
        <TooltipContent>
          Add a description or attach a PDF before generating cards with AI.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (aiRemaining <= 0 || totalRemaining <= 0) {
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
                buttonVariants({ variant: "outline", size }),
                "cursor-not-allowed opacity-50",
                className,
              )}
            >
              <Sparkles />
              <Plus />
              Add one with AI
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

  function handleClick() {
    startTransition(async () => {
      try {
        await generateOneCardWithAi({ deckId });
        toast.success("Added one card with AI.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={pending}
      className={className}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      <Plus />
      {pending ? "Adding..." : "Add one with AI"}
    </Button>
  );
}
