"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { and, count as drizzleCount, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { deckAttachmentsTable, decksTable } from "@/db/schema";
import {
  PRO_PLAN_ATTACHMENT_BYTES,
  bytesToMb,
  getPlanLimits,
  planNameForUser,
} from "@/lib/billing";

const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);

async function assertOwnsDeck(deckId: number, userId: string) {
  const deck = await db.query.decksTable.findFirst({
    where: and(eq(decksTable.id, deckId), eq(decksTable.userId, userId)),
    columns: { id: true },
  });
  if (!deck) throw new Error("Not found");
}

const addAttachmentInputSchema = z.object({
  deckId: z.number().int().positive(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  byteSize: z.number().int().positive().max(PRO_PLAN_ATTACHMENT_BYTES),
  base64: z.string().min(1),
});

export type AddAttachmentInput = z.infer<typeof addAttachmentInputSchema>;

export async function addDeckAttachment(input: AddAttachmentInput) {
  const { userId, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { deckId, filename, mimeType, byteSize, base64 } =
    addAttachmentInputSchema.parse(input);

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Only PDF files are supported.");
  }

  await assertOwnsDeck(deckId, userId);

  const isPro = has({ feature: "unlimited_deck" });
  const limits = getPlanLimits(isPro);
  const planLabel = planNameForUser(isPro);

  const [{ value: existingCount }] = await db
    .select({ value: drizzleCount() })
    .from(deckAttachmentsTable)
    .where(eq(deckAttachmentsTable.deckId, deckId));

  if (existingCount >= limits.attachmentsPerDeck) {
    throw new Error(
      `${planLabel} plan decks are limited to ${limits.attachmentsPerDeck} attachments.${
        isPro ? "" : " Upgrade to Pro for higher limits."
      }`,
    );
  }

  if (byteSize > limits.attachmentBytes) {
    throw new Error(
      `File is too large. ${planLabel} plan limit is ${bytesToMb(
        limits.attachmentBytes,
      )} MB per file.${isPro ? "" : " Upgrade to Pro for higher limits."}`,
    );
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (buffer.byteLength > limits.attachmentBytes) {
    throw new Error(
      `File is too large. ${planLabel} plan limit is ${bytesToMb(
        limits.attachmentBytes,
      )} MB per file.${isPro ? "" : " Upgrade to Pro for higher limits."}`,
    );
  }

  let extractedText = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      extractedText = (result.text ?? "").trim();
    } finally {
      await parser.destroy();
    }
  } catch {
    throw new Error("Could not read this PDF. Please try a different file.");
  }

  if (!extractedText) {
    throw new Error(
      "No text could be extracted from this PDF (it may be scanned or image-only).",
    );
  }

  await db.insert(deckAttachmentsTable).values({
    deckId,
    filename,
    byteSize,
    content: extractedText,
  });

  revalidatePath(`/decks/${deckId}`);
}

const removeAttachmentInputSchema = z.object({
  attachmentId: z.number().int().positive(),
  deckId: z.number().int().positive(),
});

export type RemoveAttachmentInput = z.infer<
  typeof removeAttachmentInputSchema
>;

export async function removeDeckAttachment(input: RemoveAttachmentInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { attachmentId, deckId } = removeAttachmentInputSchema.parse(input);

  await assertOwnsDeck(deckId, userId);

  await db
    .delete(deckAttachmentsTable)
    .where(
      and(
        eq(deckAttachmentsTable.id, attachmentId),
        eq(deckAttachmentsTable.deckId, deckId),
      ),
    );

  revalidatePath(`/decks/${deckId}`);
}
