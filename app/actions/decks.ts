"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { decksTable } from "@/db/schema";
import { getPlanLimits, planNameForUser } from "@/lib/billing";

const createDeckSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateDeckInput = z.infer<typeof createDeckSchema>;

export async function createDeck(input: CreateDeckInput) {
  const { userId, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { title, description } = createDeckSchema.parse(input);

  const isPro = has({ feature: "unlimited_deck" });
  const limits = getPlanLimits(isPro);

  const [{ value: deckCount }] = await db
    .select({ value: count() })
    .from(decksTable)
    .where(eq(decksTable.userId, userId));

  if (deckCount >= limits.decks) {
    throw new Error(
      isPro
        ? `Pro plan is limited to ${limits.decks} decks.`
        : `${planNameForUser(isPro)} plan is limited to ${limits.decks} decks. Upgrade to Pro for more.`,
    );
  }

  const [deck] = await db
    .insert(decksTable)
    .values({
      userId,
      title,
      description: description ? description : null,
    })
    .returning({ id: decksTable.id });

  revalidatePath("/");
  redirect(`/decks/${deck.id}`);
}

const updateDeckSchema = z.object({
  deckId: z.number().int().positive(),
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;

export async function updateDeck(input: UpdateDeckInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { deckId, title, description } = updateDeckSchema.parse(input);

  await db
    .update(decksTable)
    .set({
      title,
      description: description ? description : null,
    })
    .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)));

  revalidatePath("/");
  revalidatePath(`/decks/${deckId}`);
}

const deleteDeckSchema = z.object({
  deckId: z.number().int().positive(),
});

export type DeleteDeckInput = z.infer<typeof deleteDeckSchema>;

export async function deleteDeck(input: DeleteDeckInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { deckId } = deleteDeckSchema.parse(input);

  await db
    .delete(decksTable)
    .where(and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)));

  revalidatePath("/");
  redirect("/");
}
