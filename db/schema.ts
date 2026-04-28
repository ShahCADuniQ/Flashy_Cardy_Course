import { integer, pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const decksTable = pgTable("decks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar({ length: 255 }).notNull(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const cardsTable = pgTable("cards", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  deckId: integer()
    .notNull()
    .references(() => decksTable.id, { onDelete: "cascade" }),
  front: text().notNull(),
  back: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const decksRelations = relations(decksTable, ({ many }) => ({
  cards: many(cardsTable),
}));

export const cardsRelations = relations(cardsTable, ({ one }) => ({
  deck: one(decksTable, {
    fields: [cardsTable.deckId],
    references: [decksTable.id],
  }),
}));
