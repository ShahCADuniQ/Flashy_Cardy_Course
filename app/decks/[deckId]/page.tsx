import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, Layers } from "lucide-react";

import { db } from "@/db";
import { cardsTable, deckAttachmentsTable, decksTable } from "@/db/schema";
import { getPlanLimits } from "@/lib/billing";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeckFormDialog } from "@/components/decks/deck-form-dialog";
import { DeleteDeckButton } from "@/components/decks/delete-deck-button";
import { DeckAttachments } from "@/components/decks/deck-attachments";
import { CardFormDialog } from "@/components/cards/card-form-dialog";
import { DeleteCardButton } from "@/components/cards/delete-card-button";
import { GenerateCardsButton } from "@/components/cards/generate-cards-button";
import { GenerateOneCardButton } from "@/components/cards/generate-one-card-button";

type PageParams = { deckId: string };

export default async function DeckPage({
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

  const [cards, attachments] = await Promise.all([
    db
      .select()
      .from(cardsTable)
      .where(eq(cardsTable.deckId, deck.id))
      .orderBy(asc(cardsTable.id)),
    db
      .select({
        id: deckAttachmentsTable.id,
        filename: deckAttachmentsTable.filename,
        byteSize: deckAttachmentsTable.byteSize,
      })
      .from(deckAttachmentsTable)
      .where(eq(deckAttachmentsTable.deckId, deck.id))
      .orderBy(asc(deckAttachmentsTable.id)),
  ]);

  const hasDescription = Boolean(deck.description?.trim());
  const hasAiContext = hasDescription || attachments.length > 0;
  const aiCardCount = cards.reduce(
    (n, card) => (card.aiGenerated ? n + 1 : n),
    0,
  );
  const totalCardCount = cards.length;
  const aiRemaining = Math.max(0, limits.aiCardsPerDeck - aiCardCount);
  const totalRemaining = Math.max(0, limits.totalCardsPerDeck - totalCardCount);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to decks
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {deck.title}
            </h1>
            <Badge variant="secondary">
              {cards.length} {cards.length === 1 ? "card" : "cards"}
            </Badge>
          </div>
          {deck.description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {deck.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cards.length > 0 ? (
            <Link
              href={`/decks/${deck.id}/study`}
              className={cn(buttonVariants())}
            >
              Study
              <ArrowRight />
            </Link>
          ) : null}
          <DeckFormDialog
            mode="edit"
            deck={{
              id: deck.id,
              title: deck.title,
              description: deck.description,
            }}
          />
          <DeleteDeckButton deckId={deck.id} deckTitle={deck.title} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <DeckAttachments
          deckId={deck.id}
          attachments={attachments}
          maxBytes={limits.attachmentBytes}
          maxPerDeck={limits.attachmentsPerDeck}
          isPro={isPro}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-medium">Cards</h2>
          <div className="flex flex-wrap items-center gap-2">
            <GenerateCardsButton
              deckId={deck.id}
              hasAiFeature={hasAiFeature}
              hasAiContext={hasAiContext}
              aiRemaining={aiRemaining}
              totalRemaining={totalRemaining}
              isPro={isPro}
            />
            <GenerateOneCardButton
              deckId={deck.id}
              hasAiFeature={hasAiFeature}
              hasAiContext={hasAiContext}
              aiRemaining={aiRemaining}
              totalRemaining={totalRemaining}
              isPro={isPro}
            />
            <CardFormDialog
              mode="create"
              deckId={deck.id}
              hasAiFeature={hasAiFeature}
              hasAiContext={hasAiContext}
              totalRemaining={totalRemaining}
              isPro={isPro}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {totalCardCount} / {limits.totalCardsPerDeck} cards · {aiCardCount} /{" "}
          {limits.aiCardsPerDeck} AI-generated
          {!isPro && (
            <>
              {" "}
              ·{" "}
              <Link
                href="/pricing"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Upgrade to Pro
              </Link>{" "}
              for higher limits
            </>
          )}
        </p>
      </div>

      {cards.length === 0 ? (
        <Card className="items-center py-14 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Layers className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-heading text-base font-medium">
                No cards yet
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add your first card to start studying. Each card has a front
                (the question or prompt) and a back (the answer).
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <CardFormDialog
                mode="create"
                deckId={deck.id}
                hasAiFeature={hasAiFeature}
                hasAiContext={hasAiContext}
                totalRemaining={totalRemaining}
                isPro={isPro}
              />
              <GenerateCardsButton
                deckId={deck.id}
                hasAiFeature={hasAiFeature}
                hasAiContext={hasAiContext}
                aiRemaining={aiRemaining}
                totalRemaining={totalRemaining}
                isPro={isPro}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <ol className="flex flex-col gap-3">
          {cards.map((card, index) => (
            <li key={card.id}>
              <Card size="sm">
                <CardHeader className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Card {index + 1}
                  </span>
                  <CardAction className="flex items-center gap-1">
                    <CardFormDialog
                      mode="edit"
                      deckId={deck.id}
                      hasAiFeature={hasAiFeature}
                      hasAiContext={hasAiContext}
                      totalRemaining={totalRemaining}
                      isPro={isPro}
                      card={{
                        id: card.id,
                        front: card.front,
                        back: card.back,
                      }}
                    />
                    <DeleteCardButton cardId={card.id} deckId={deck.id} />
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Front
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{card.front}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Back
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{card.back}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
