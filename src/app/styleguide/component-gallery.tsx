"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, Separator, Skeleton } from "@/components/ui/feedback";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { FilterIcon, InfoIcon, PinIcon, TrashIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionItem, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { SideViewGallery } from "./side-view";

const FLOORS = [
  { value: "1", label: "1st floor" },
  { value: "2", label: "2nd floor" },
  { value: "3", label: "3rd floor" },
];

// Live examples of every component in src/components/ui, so each one can be
// checked with the keyboard and in every display mode.
export function ComponentGallery() {
  const id = useId();
  const toast = useToast();
  const [floor, setFloor] = useState("2");

  return (
    <div className="flex flex-col gap-8">
      <Example title="Dialog, confirm, sheet, popover, tooltip, toast">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Report the noise level</DialogTitle>
              <DialogDescription>How loud is Shapiro Library, 2nd floor, right now?</DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Send report</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            trigger={
              <Button variant="destructive">
                <TrashIcon />
                Delete check-in
              </Button>
            }
            title="Delete this check-in?"
            description="It will no longer count toward this space's reports. This can't be undone."
            confirmLabel="Delete check-in"
            onConfirm={() => toast({ title: "Check-in deleted" })}
          />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open bottom sheet</Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetTitle>Shapiro Library, 2nd floor</SheetTitle>
              <SheetDescription>Quiet · Natural light · Step-free</SheetDescription>
              <Button className="self-start">
                <PinIcon />
                Check in
              </Button>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open side sheet</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Preferences sort results; they never hide spaces.</SheetDescription>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <FilterIcon />
                Popover
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-sm">Anchored to its trigger. Esc closes it.</p>
            </PopoverContent>
          </Popover>

          <Tooltip content="Reported by 12 people this week">
            <Button variant="ghost" size="icon" aria-label="About this rating">
              <InfoIcon />
            </Button>
          </Tooltip>

          <Button
            variant="outline"
            onClick={() => toast({ title: "Checked in", description: "Shapiro Library, 2nd floor" })}
          >
            Show toast
          </Button>
        </div>
      </Example>

      <Example title="Form controls">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-name`}>Space name</Label>
            <Input id={`${id}-name`} placeholder="e.g. Shapiro 2nd floor" aria-describedby={`${id}-name-hint`} />
            <FieldHint id={`${id}-name-hint`}>Shown on the map pin.</FieldHint>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-floor`}>Floor</Label>
            <Select id={`${id}-floor`} options={FLOORS} value={floor} onValueChange={setFloor} />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id={`${id}-outlets`} defaultChecked />
            <Label htmlFor={`${id}-outlets`}>Has outlets</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id={`${id}-open`} />
            <Label htmlFor={`${id}-open`}>Only show open spaces</Label>
          </div>
        </div>
      </Example>

      <Example title="Tabs and accordion">
        <Tabs defaultValue="map" className="flex flex-col gap-3">
          <TabsList aria-label="View" className="self-start">
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
          <TabsContent value="map">The map view.</TabsContent>
          <TabsContent value="list">The list view.</TabsContent>
        </Tabs>
        <Accordion type="single" collapsible>
          <AccordionItem value="hours" title="Hours">
            Mon–Thu 8 AM – 2 AM · Fri 8 AM – 9 PM
          </AccordionItem>
          <AccordionItem value="spaces" title="Spaces by floor">
            2nd floor: 3 quiet spaces
          </AccordionItem>
        </Accordion>
      </Example>

      <Example title="Loading and empty states">
        <div className="grid gap-6 sm:grid-cols-2">
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">Loading spaces…</span>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <EmptyState
            icon={<PinIcon size="lg" />}
            title="No spaces match"
            description="Try a different building or turn off a filter."
            action={<Button variant="outline" size="sm">Clear filters</Button>}
          />
        </div>
        <Separator />
      </Example>

      <div id="side-view">
        <SideViewGallery />
      </div>
    </div>
  );
}

function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg">{title}</h3>
      {children}
    </div>
  );
}
