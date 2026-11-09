// True while a sheet or dialog is open. Arrival waits; it must not stack
// on the search screen or another sheet.
export function isDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']") != null
  );
}

// On wide screens the check-in and booking sheets are a compact card at the
// bottom center, not a window-wide strip (QA-088). Fixed with left and right
// at 0, a width plus auto margins centers it without a transform, so the
// slide-up animation still owns `transform`.
export const COMPACT_ON_WIDE = "md:bottom-4 md:mx-auto md:w-[min(28rem,100%)] md:rounded-2xl md:border";
