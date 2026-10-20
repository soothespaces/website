import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { PanelBackButton } from "@/components/ui/panel-back-button";

const iconButton = "text-muted-foreground hover:text-foreground";

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
        <PanelBackButton label="Back" onClick={onBack} />
      ) : (
        <span />
      )}
      <Button variant="ghost" size="icon" shape="circle" onClick={onClose} className={iconButton} aria-label={closeLabel}>
        <CloseIcon />
      </Button>
    </div>
  );
}
