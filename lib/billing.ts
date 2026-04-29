export const FREE_PLAN_DECK_LIMIT = 3;
export const PRO_PLAN_DECK_LIMIT = 50;

export const FREE_PLAN_AI_CARDS_PER_DECK = 50;
export const FREE_PLAN_TOTAL_CARDS_PER_DECK = 200;

export const PRO_PLAN_AI_CARDS_PER_DECK = 500;
export const PRO_PLAN_TOTAL_CARDS_PER_DECK = 1000;

const MB = 1024 * 1024;

export const FREE_PLAN_ATTACHMENT_BYTES = 10 * MB;
export const FREE_PLAN_ATTACHMENTS_PER_DECK = 5;

export const PRO_PLAN_ATTACHMENT_BYTES = 50 * MB;
export const PRO_PLAN_ATTACHMENTS_PER_DECK = 10;

export type PlanLimits = {
  decks: number;
  aiCardsPerDeck: number;
  totalCardsPerDeck: number;
  attachmentBytes: number;
  attachmentsPerDeck: number;
};

export function getPlanLimits(isPro: boolean): PlanLimits {
  if (isPro) {
    return {
      decks: PRO_PLAN_DECK_LIMIT,
      aiCardsPerDeck: PRO_PLAN_AI_CARDS_PER_DECK,
      totalCardsPerDeck: PRO_PLAN_TOTAL_CARDS_PER_DECK,
      attachmentBytes: PRO_PLAN_ATTACHMENT_BYTES,
      attachmentsPerDeck: PRO_PLAN_ATTACHMENTS_PER_DECK,
    };
  }
  return {
    decks: FREE_PLAN_DECK_LIMIT,
    aiCardsPerDeck: FREE_PLAN_AI_CARDS_PER_DECK,
    totalCardsPerDeck: FREE_PLAN_TOTAL_CARDS_PER_DECK,
    attachmentBytes: FREE_PLAN_ATTACHMENT_BYTES,
    attachmentsPerDeck: FREE_PLAN_ATTACHMENTS_PER_DECK,
  };
}

export function bytesToMb(bytes: number): number {
  return Math.round(bytes / MB);
}

export function planNameForUser(isPro: boolean): "Pro" | "Free" {
  return isPro ? "Pro" : "Free";
}
