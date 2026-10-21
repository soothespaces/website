import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

const HEADINGS = { 2: "h2", 3: "h3", 4: "h4" } as const;

type SectionAction =
  | { label: string; href: string; onClick?: undefined }
  | { label: string; onClick: () => void; href?: undefined };

export function SectionHeader({
  title,
  action,
  level = 2,
  className,
}: {
  title: string;
  action?: SectionAction;
  level?: keyof typeof HEADINGS;
  className?: string;
}) {
  const Heading = HEADINGS[level];
  return (
    <div className={cx("flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1", className)}>
      <Heading className="min-w-0 text-base font-semibold break-words">{title}</Heading>
      {action ? <SectionActionLink action={action} /> : null}
    </div>
  );
}

function SectionActionLink({ action }: { action: SectionAction }) {
  const className = "text-sm font-medium text-primary underline underline-offset-2";
  if (action.href != null) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(event) => {
        // The panel that holds this button is about to be hidden. Leave it
        // before that, so focus is not trapped under aria-hidden.
        event.currentTarget.blur();
        action.onClick();
      }}
      className={cx(className, "h-auto min-h-0 px-0 py-0 hover:bg-transparent")}
    >
      {action.label}
    </Button>
  );
}
