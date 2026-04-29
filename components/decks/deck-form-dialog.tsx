"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDeck, updateDeck } from "@/app/actions/decks";

type DeckFormDialogProps = {
  mode: "create" | "edit";
  deck?: {
    id: number;
    title: string;
    description: string | null;
  };
  trigger?: React.ReactElement;
};

export function DeckFormDialog({ mode, deck, trigger }: DeckFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState(deck?.title ?? "");
  const [description, setDescription] = React.useState(deck?.description ?? "");

  React.useEffect(() => {
    if (open) {
      setTitle(deck?.title ?? "");
      setDescription(deck?.description ?? "");
    }
  }, [open, deck?.title, deck?.description]);

  const isEdit = mode === "edit";

  const defaultTrigger = isEdit ? (
    <Button variant="outline" size="sm">
      <Pencil />
      Edit
    </Button>
  ) : (
    <Button>
      <Plus />
      New deck
    </Button>
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    startTransition(async () => {
      try {
        if (isEdit && deck) {
          await updateDeck({
            deckId: deck.id,
            title: title.trim(),
            description: description.trim(),
          });
          toast.success("Deck updated");
          setOpen(false);
          router.refresh();
        } else {
          await createDeck({
            title: title.trim(),
            description: description.trim(),
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
          throw error;
        }
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit deck" : "Create a new deck"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update your deck's title or description."
              : "Give your new deck a title. You can add cards once it's created."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-title">Title</Label>
            <Input
              id="deck-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Spanish Vocabulary"
              maxLength={255}
              required
              autoFocus
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-description">Description</Label>
            <Textarea
              id="deck-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
              maxLength={2000}
              rows={3}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Create deck"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
