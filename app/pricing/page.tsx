import type { Metadata } from "next";
import { PricingTable } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Pricing | Flashy Cardy",
  description:
    "Choose the Flashy Cardy plan that fits how you study. Upgrade for unlimited decks and AI-generated flashcards.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Pricing
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Start free with up to 3 decks, or upgrade to Pro for unlimited decks
          and AI-powered flashcard generation.
        </p>
      </div>

      <PricingTable />
    </div>
  );
}
