import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, asc, count as drizzleCount, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { db } from "@/db";
import {
  cardsTable,
  deckAttachmentsTable,
  decksTable,
} from "@/db/schema";
import { getPlanLimits } from "@/lib/billing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StudyDeck } from "@/components/cards/study-deck";

type PageParams = { deckId: string };

export default async function StudyPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { userId, has } = await auth();
  if (!userId) redirect("/");

  const hasAiFeature = has({ feature: "ai_flash_card_generation" });
  const isPro = has({ feature: "unlimited_deck" });
  const limits = getPlanLimits(isPro);

  const { deckId: rawDeckId } = await params;
  const deckId = Number(rawDeckId);
  if (!Number.isInteger(deckId) || deckId <= 0) notFound();

  const deck = await db.query.decksTable.findFirst({
    where: and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)),
  });

  if (!deck) notFound();

  const hasDescription = Boolean(deck.description?.trim());

  const [cards, [{ value: attachmentCount }]] = await Promise.all([
    db
      .select({
        id: cardsTable.id,
        front: cardsTable.front,
        back: cardsTable.back,
        aiGenerated: cardsTable.aiGenerated,
      })
      .from(cardsTable)
      .where(eq(cardsTable.deckId, deck.id))
      .orderBy(asc(cardsTable.id)),
    db
      .select({ value: drizzleCount() })
      .from(deckAttachmentsTable)
      .where(eq(deckAttachmentsTable.deckId, deck.id)),
  ]);

  const hasAiContext = hasDescription || attachmentCount > 0;

  const aiCardCount = cards.reduce(
    (n, card) => (card.aiGenerated ? n + 1 : n),
    0,
  );
  const totalCardCount = cards.length;
  const aiRemaining = Math.max(0, limits.aiCardsPerDeck - aiCardCount);
  const totalRemaining = Math.max(0, limits.totalCardsPerDeck - totalCardCount);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/decks/${deck.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to deck
      </Link>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Studying
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {deck.title}
        </h1>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-base text-muted-foreground">
            This deck has no cards yet. Add some cards to start studying.
          </p>
          <Link
            href={`/decks/${deck.id}`}
            className={cn(buttonVariants())}
          >
            Add cards
          </Link>
        </div>
      ) : (
        <StudyDeck
          deckId={deck.id}
          cards={cards.map(({ id, front, back }) => ({ id, front, back }))}
          hasAiFeature={hasAiFeature}
          hasAiContext={hasAiContext}
          aiRemaining={aiRemaining}
          totalRemaining={totalRemaining}
          isPro={isPro}
        />
      )}
    </div>
  );
}
