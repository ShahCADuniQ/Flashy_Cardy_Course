"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { and, count as drizzleCount, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { cardsTable, decksTable } from "@/db/schema";
import { getPlanLimits, planNameForUser } from "@/lib/billing";

async function assertOwnsDeck(deckId: number, userId: string) {
  const deck = await db.query.decksTable.findFirst({
    where: and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)),
    columns: { id: true },
  });
  if (!deck) throw new Error("Not found");
}

async function assertCanInsertCards(deckId: number, additional: number, isPro: boolean) {
  const limits = getPlanLimits(isPro);
  const [{ value: total }] = await db
    .select({ value: drizzleCount() })
    .from(cardsTable)
    .where(eq(cardsTable.deckId, deckId));

  if (total + additional > limits.totalCardsPerDeck) {
    const remaining = Math.max(0, limits.totalCardsPerDeck - total);
    throw new Error(
      isPro
        ? `This deck is limited to ${limits.totalCardsPerDeck} cards on the Pro plan (${remaining} slot${remaining === 1 ? "" : "s"} left).`
        : `${planNameForUser(isPro)} plan decks are limited to ${limits.totalCardsPerDeck} cards (${remaining} slot${remaining === 1 ? "" : "s"} left). Upgrade to Pro for more.`,
    );
  }
}

const createCardSchema = z.object({
  deckId: z.number().int().positive(),
  front: z.string().trim().min(1, "Front is required").max(2000),
  back: z.string().trim().min(1, "Back is required").max(2000),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;

export async function createCard(input: CreateCardInput) {
  const { userId, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { deckId, front, back } = createCardSchema.parse(input);

  await assertOwnsDeck(deckId, userId);

  const isPro = has({ feature: "unlimited_deck" });
  await assertCanInsertCards(deckId, 1, isPro);

  await db.insert(cardsTable).values({ deckId, front, back });

  revalidatePath(`/decks/${deckId}`);
}

const updateCardSchema = z.object({
  cardId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  front: z.string().trim().min(1, "Front is required").max(2000),
  back: z.string().trim().min(1, "Back is required").max(2000),
});

export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export async function updateCard(input: UpdateCardInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { cardId, deckId, front, back } = updateCardSchema.parse(input);

  await assertOwnsDeck(deckId, userId);

  await db
    .update(cardsTable)
    .set({ front, back })
    .where(and(eq(cardsTable.id, cardId), eq(cardsTable.deckId, deckId)));

  revalidatePath(`/decks/${deckId}`);
}

const deleteCardSchema = z.object({
  cardId: z.number().int().positive(),
  deckId: z.number().int().positive(),
});

export type DeleteCardInput = z.infer<typeof deleteCardSchema>;

export async function deleteCard(input: DeleteCardInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { cardId, deckId } = deleteCardSchema.parse(input);

  await assertOwnsDeck(deckId, userId);

  await db
    .delete(cardsTable)
    .where(and(eq(cardsTable.id, cardId), eq(cardsTable.deckId, deckId)));

  revalidatePath(`/decks/${deckId}`);
}
