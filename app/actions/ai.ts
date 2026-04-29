"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { and, asc, count as drizzleCount, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { cardsTable, deckAttachmentsTable, decksTable } from "@/db/schema";
import { getPlanLimits, planNameForUser } from "@/lib/billing";

const MIN_CARD_COUNT = 1;
const MAX_CARD_COUNT = 50;
const MAX_ATTACHMENT_CONTEXT_CHARS = 24_000;
const MAX_EXISTING_CARDS_IN_PROMPT = 60;
const AI_MODEL = "gpt-5.5";

async function loadDeckCardUsage(deckId: number) {
  const [row] = await db
    .select({
      total: drizzleCount(),
      ai: sql<number>`coalesce(sum(case when ${cardsTable.aiGenerated} then 1 else 0 end), 0)::int`,
    })
    .from(cardsTable)
    .where(eq(cardsTable.deckId, deckId));
  return {
    total: Number(row?.total ?? 0),
    ai: Number(row?.ai ?? 0),
  };
}

function assertAiCapacity(input: {
  isPro: boolean;
  total: number;
  ai: number;
  additional: number;
}) {
  const { isPro, total, ai, additional } = input;
  const limits = getPlanLimits(isPro);
  const aiRemaining = Math.max(0, limits.aiCardsPerDeck - ai);
  const totalRemaining = Math.max(0, limits.totalCardsPerDeck - total);

  if (additional > aiRemaining) {
    throw new Error(
      `${planNameForUser(isPro)} plan allows up to ${limits.aiCardsPerDeck} AI-generated cards per deck (${aiRemaining} left). ${
        isPro ? "" : "Upgrade to Pro for higher limits. "
      }`,
    );
  }

  if (additional > totalRemaining) {
    throw new Error(
      `This deck can hold up to ${limits.totalCardsPerDeck} cards on the ${planNameForUser(isPro)} plan (${totalRemaining} slot${totalRemaining === 1 ? "" : "s"} left). ${
        isPro ? "" : "Upgrade to Pro for higher limits. "
      }`,
    );
  }
}

async function loadDeckForAi(deckId: number, userId: string) {
  const deck = await db.query.decksTable.findFirst({
    where: and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)),
    columns: { id: true, title: true, description: true },
  });
  if (!deck) throw new Error("Not found");

  const description = deck.description?.trim() || null;

  return { id: deck.id, title: deck.title, description };
}

function assertHasAiContext(input: {
  description: string | null;
  attachmentsContext: string | null;
}) {
  if (!input.description && !input.attachmentsContext) {
    throw new Error(
      "Add a description to this deck or attach a PDF before generating cards with AI.",
    );
  }
}

async function loadAttachmentsContext(deckId: number) {
  const attachments = await db
    .select({
      filename: deckAttachmentsTable.filename,
      content: deckAttachmentsTable.content,
    })
    .from(deckAttachmentsTable)
    .where(eq(deckAttachmentsTable.deckId, deckId))
    .orderBy(asc(deckAttachmentsTable.id));

  if (attachments.length === 0) return null;

  const sections: string[] = [];
  let used = 0;
  for (const att of attachments) {
    if (used >= MAX_ATTACHMENT_CONTEXT_CHARS) break;
    const remaining = MAX_ATTACHMENT_CONTEXT_CHARS - used;
    const slice = att.content.slice(0, remaining);
    sections.push(`--- Attachment: ${att.filename} ---\n${slice}`);
    used += slice.length;
  }
  return sections.join("\n\n");
}

async function loadExistingCards(deckId: number) {
  const existing = await db
    .select({ front: cardsTable.front, back: cardsTable.back })
    .from(cardsTable)
    .where(eq(cardsTable.deckId, deckId))
    .orderBy(asc(cardsTable.id))
    .limit(MAX_EXISTING_CARDS_IN_PROMPT);
  return existing;
}

function commonGuidelines(count: number) {
  return [
    `Each card has two sides:`,
    `- "front": a single prompt the learner sees first.`,
    `- "back": the answer the learner should recall when flipping the card.`,
    ``,
    `Guidelines:`,
    `- Infer the appropriate format and depth from the deck's title, description, and any attached source material. Do not assume a particular subject area or style of card unless the deck makes it clear.`,
    `- Each card should test exactly one focused idea, fact, term, or recall target. Do not bundle multiple concepts into one card.`,
    `- Match the granularity the deck implies. If the deck is about discrete facts or definitions, the back should be the direct answer with as little extra text as needed. If the deck is about concepts that genuinely require explanation, a brief explanation on the back is fine — but never pad cards with filler.`,
    `- Keep both sides as concise as the subject allows. Prefer short, clean phrasing over long sentences.`,
    `- Do not number the cards, do not add prefixes like "Q:" / "A:", and do not include the deck title in every card.`,
    count > 1
      ? `- Cover a useful spread of the deck's scope; avoid duplicate or near-duplicate cards.`
      : `- Avoid duplicating any card already in the deck.`,
    `- Write in the same language(s) the deck implies. If the deck is about translating between two languages, put one language on the front and the other on the back, with no extra commentary.`,
  ].join("\n");
}

function buildBatchPrompt(input: {
  deck: { title: string; description: string | null };
  count: number;
  attachmentsContext: string | null;
  existingCards: { front: string; back: string }[];
}) {
  const { deck, count, attachmentsContext, existingCards } = input;
  const parts: string[] = [];
  parts.push(`You are generating flashcards for a study deck.`);
  parts.push("");
  parts.push(`Deck title: ${deck.title}`);
  if (deck.description) {
    parts.push(`Deck description: ${deck.description}`);
  } else {
    parts.push(
      `Deck description: (none provided — infer the subject from the title and attached reference material)`,
    );
  }
  parts.push("");
  parts.push(`Generate exactly ${count} flashcards that fit this deck.`);
  parts.push("");
  parts.push(commonGuidelines(count));

  if (existingCards.length > 0) {
    parts.push("");
    parts.push(
      `Existing cards already in this deck — do NOT repeat or paraphrase these:`,
    );
    for (const c of existingCards) {
      parts.push(`- front: ${c.front} | back: ${c.back}`);
    }
  }

  if (attachmentsContext) {
    parts.push("");
    parts.push(
      `The deck has attached reference material. Use it as the primary source of truth. If the attached material conflicts with general knowledge, prefer the attached material.`,
    );
    parts.push("");
    parts.push(`Attached reference material:`);
    parts.push(attachmentsContext);
  }

  return parts.join("\n");
}

const generateCardsInputSchema = z.object({
  deckId: z.number().int().positive(),
  count: z.number().int().min(MIN_CARD_COUNT).max(MAX_CARD_COUNT),
});

export type GenerateCardsInput = z.infer<typeof generateCardsInputSchema>;

const cardsOutputSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(2000),
        back: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(MAX_CARD_COUNT),
});

export async function generateCardsWithAi(input: GenerateCardsInput) {
  const { userId, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!has({ feature: "ai_flash_card_generation" })) {
    throw new Error("Upgrade to Pro to generate flash cards with AI.");
  }

  const { deckId, count } = generateCardsInputSchema.parse(input);

  const deck = await loadDeckForAi(deckId, userId);
  const isPro = has({ feature: "unlimited_deck" });
  const usage = await loadDeckCardUsage(deck.id);
  assertAiCapacity({
    isPro,
    total: usage.total,
    ai: usage.ai,
    additional: count,
  });

  const [attachmentsContext, existingCards] = await Promise.all([
    loadAttachmentsContext(deck.id),
    loadExistingCards(deck.id),
  ]);

  assertHasAiContext({ description: deck.description, attachmentsContext });

  const { output } = await generateText({
    model: openai(AI_MODEL),
    output: Output.object({ schema: cardsOutputSchema }),
    prompt: buildBatchPrompt({
      deck,
      count,
      attachmentsContext,
      existingCards,
    }),
  });

  if (output.cards.length === 0) {
    throw new Error("AI did not return any cards. Please try again.");
  }

  const inserted = await db
    .insert(cardsTable)
    .values(
      output.cards.map((card) => ({
        deckId: deck.id,
        front: card.front,
        back: card.back,
        aiGenerated: true,
      })),
    )
    .returning({
      id: cardsTable.id,
      front: cardsTable.front,
      back: cardsTable.back,
    });

  revalidatePath(`/decks/${deck.id}`);

  return { generated: inserted.length, cards: inserted };
}

const generateOneCardInputSchema = z.object({
  deckId: z.number().int().positive(),
});

export type GenerateOneCardInput = z.infer<typeof generateOneCardInputSchema>;

const oneCardOutputSchema = z.object({
  card: z.object({
    front: z.string().min(1).max(2000),
    back: z.string().min(1).max(2000),
  }),
});

export async function generateOneCardWithAi(input: GenerateOneCardInput) {
  const { userId, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!has({ feature: "ai_flash_card_generation" })) {
    throw new Error("Upgrade to Pro to generate flash cards with AI.");
  }

  const { deckId } = generateOneCardInputSchema.parse(input);

  const deck = await loadDeckForAi(deckId, userId);
  const isPro = has({ feature: "unlimited_deck" });
  const usage = await loadDeckCardUsage(deck.id);
  assertAiCapacity({
    isPro,
    total: usage.total,
    ai: usage.ai,
    additional: 1,
  });

  const [attachmentsContext, existingCards] = await Promise.all([
    loadAttachmentsContext(deck.id),
    loadExistingCards(deck.id),
  ]);

  assertHasAiContext({ description: deck.description, attachmentsContext });

  const parts: string[] = [];
  parts.push(`You are adding ONE additional flashcard to an existing deck.`);
  parts.push("");
  parts.push(`Deck title: ${deck.title}`);
  if (deck.description) {
    parts.push(`Deck description: ${deck.description}`);
  } else {
    parts.push(
      `Deck description: (none provided — infer the subject from the title and attached reference material)`,
    );
  }
  parts.push("");
  parts.push(`Generate exactly 1 flashcard.`);
  parts.push("");
  parts.push(commonGuidelines(1));
  if (existingCards.length > 0) {
    parts.push("");
    parts.push(
      `Existing cards already in this deck — your new card MUST cover something different and useful:`,
    );
    for (const c of existingCards) {
      parts.push(`- front: ${c.front} | back: ${c.back}`);
    }
  }
  if (attachmentsContext) {
    parts.push("");
    parts.push(`Attached reference material:`);
    parts.push(attachmentsContext);
  }

  const { output } = await generateText({
    model: openai(AI_MODEL),
    output: Output.object({ schema: oneCardOutputSchema }),
    prompt: parts.join("\n"),
  });

  const [inserted] = await db
    .insert(cardsTable)
    .values({
      deckId: deck.id,
      front: output.card.front,
      back: output.card.back,
      aiGenerated: true,
    })
    .returning({
      id: cardsTable.id,
      front: cardsTable.front,
      back: cardsTable.back,
    });

  revalidatePath(`/decks/${deck.id}`);

  return { card: inserted };
}

const generateBackInputSchema = z.object({
  deckId: z.number().int().positive(),
  front: z.string().trim().min(1).max(2000),
});

export type GenerateBackInput = z.infer<typeof generateBackInputSchema>;

const backOutputSchema = z.object({
  back: z.string().min(1).max(2000),
});

export async function generateCardBackWithAi(input: GenerateBackInput) {
  const { userId, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!has({ feature: "ai_flash_card_generation" })) {
    throw new Error("Upgrade to Pro to generate flash cards with AI.");
  }

  const { deckId, front } = generateBackInputSchema.parse(input);

  const deck = await loadDeckForAi(deckId, userId);
  const attachmentsContext = await loadAttachmentsContext(deck.id);

  assertHasAiContext({ description: deck.description, attachmentsContext });

  const parts: string[] = [];
  parts.push(
    `You are completing the BACK of a single flashcard. The user has written the front; you will write the back.`,
  );
  parts.push("");
  parts.push(`Deck title: ${deck.title}`);
  if (deck.description) {
    parts.push(`Deck description: ${deck.description}`);
  } else {
    parts.push(
      `Deck description: (none provided — infer the subject from the title, the front of the card, and any attached reference material)`,
    );
  }
  parts.push("");
  parts.push(`Card front:`);
  parts.push(front);
  parts.push("");
  parts.push(
    `Write the back of this card so that it is the answer the learner should recall when flipping it.`,
  );
  parts.push("");
  parts.push(commonGuidelines(1));
  if (attachmentsContext) {
    parts.push("");
    parts.push(
      `Use the attached reference material as the primary source of truth if it covers the front of this card.`,
    );
    parts.push("");
    parts.push(`Attached reference material:`);
    parts.push(attachmentsContext);
  }

  const { output } = await generateText({
    model: openai(AI_MODEL),
    output: Output.object({ schema: backOutputSchema }),
    prompt: parts.join("\n"),
  });

  return { back: output.back };
}
