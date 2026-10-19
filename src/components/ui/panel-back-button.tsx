import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { BackIcon } from "@/components/ui/icons";

// The round back control shared by the map panel and detail screens.
export function PanelBackButton({
  label,
  onClick,
  icon = <BackIcon />,
}: {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      shape="circle"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground"
      aria-label={label}
    >
      {icon}
    </Button>
  );
}
