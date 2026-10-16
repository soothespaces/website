import { BackIcon, CloseIcon } from "@/components/ui/icons";

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground";

// The top row of the selection panel: Back when there's somewhere to go
// back to, and Close, which returns to the search results.
export function PanelHeader({
  canGoBack,
  onBack,
  onClose,
  closeLabel = "Close",
}: {
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      {canGoBack ? (
        <button type="button" onClick={onBack} className={iconButton} aria-label="Back">
          <BackIcon />
        </button>
      ) : (
        <span />
      )}
      <button type="button" onClick={onClose} className={iconButton} aria-label={closeLabel}>
        <CloseIcon />
      </button>
    </div>
  );
}
