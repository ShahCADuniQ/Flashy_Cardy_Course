import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowRight, Layers, Sparkles } from "lucide-react";

import { db } from "@/db";
import { cardsTable, decksTable } from "@/db/schema";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeckFormDialog } from "@/components/decks/deck-form-dialog";
import { getPlanLimits } from "@/lib/billing";
import { cn } from "@/lib/utils";

export default async function Home() {
  const { userId, has } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  const decks = await db
    .select({
      id: decksTable.id,
      title: decksTable.title,
      description: decksTable.description,
      updatedAt: decksTable.updatedAt,
      cardCount: sql<number>`coalesce(count(${cardsTable.id}), 0)::int`,
    })
    .from(decksTable)
    .leftJoin(cardsTable, eq(cardsTable.deckId, decksTable.id))
    .where(eq(decksTable.userId, userId))
    .groupBy(decksTable.id)
    .orderBy(desc(decksTable.updatedAt));

  const isPro = has({ feature: "unlimited_deck" });
  const limits = getPlanLimits(isPro);
  const atDeckLimit = decks.length >= limits.decks;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Your decks
          </h1>
          <p className="text-sm text-muted-foreground">
            Build flashcard decks, fill them with cards, and study at your own
            pace.
          </p>
          <p className="text-xs text-muted-foreground">
            {decks.length} of {limits.decks} decks used on the{" "}
            {isPro ? "Pro" : "Free"} plan.{" "}
            <span className="text-muted-foreground">
              Per deck: up to {limits.aiCardsPerDeck} AI-generated cards and{" "}
              {limits.totalCardsPerDeck} total cards.
            </span>
            {!isPro && (
              <>
                {" "}
                <Link
                  href="/pricing"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Upgrade to Pro
                </Link>{" "}
                for higher limits.
              </>
            )}
          </p>
        </div>
        {atDeckLimit ? (
          <Link
            href="/pricing"
            className={cn(buttonVariants())}
            aria-label={
              isPro
                ? "You've reached the Pro deck limit"
                : "Upgrade to Pro for more decks"
            }
          >
            <Sparkles />
            {isPro ? "Deck limit reached" : "Upgrade for more decks"}
          </Link>
        ) : (
          <DeckFormDialog mode="create" />
        )}
      </div>

      {decks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              id={deck.id}
              title={deck.title}
              description={deck.description}
              cardCount={Number(deck.cardCount)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeckCard({
  id,
  title,
  description,
  cardCount,
}: {
  id: number;
  title: string;
  description: string | null;
  cardCount: number;
}) {
  return (
    <Card className="transition-shadow hover:ring-foreground/20">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="line-clamp-3 min-h-[3em]">
          {description ?? "No description"}
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">
            {cardCount} {cardCount === 1 ? "card" : "cards"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="mt-auto flex items-center gap-2 pt-0">
        <Link
          href={`/decks/${id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Manage
        </Link>
        {cardCount === 0 ? (
          <Button size="sm" disabled>
            Study
            <ArrowRight />
          </Button>
        ) : (
          <Link
            href={`/decks/${id}/study`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Study
            <ArrowRight />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="items-center py-16 text-center">
      <CardContent className="flex flex-col items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Layers className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-medium">No decks yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first deck to start adding flashcards. You can study
            them anytime once you&apos;ve added some cards.
          </p>
        </div>
        <DeckFormDialog mode="create" />
      </CardContent>
    </Card>
  );
}

function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-4 py-20 text-center sm:py-32">
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" />
        Flashcards, made simple
      </div>
      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        Learn faster with your own flashcard decks.
      </h1>
      <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
        Flashy Cardy lets you build, organize, and study flashcard decks. Sign
        up to start creating decks like Spanish vocabulary, British history, or
        anything you want to memorize.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <SignUpButton mode="modal">
          <Button size="lg">Get started</Button>
        </SignUpButton>
        <SignInButton mode="modal">
          <Button size="lg" variant="outline">
            Sign in
          </Button>
        </SignInButton>
      </div>
    </div>
  );
}
