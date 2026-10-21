// True while a sheet or dialog is open. Arrival waits; it must not stack
// on the search screen or another sheet.
export function isDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open']") != null
  );
}
