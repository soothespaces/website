import { FOOTNOTES } from "@/lib/site";

// A superscript link to a footnote listed in the site footer.
export function FootnoteRef({ id }: { id: string }) {
  const index = FOOTNOTES.findIndex((note) => note.id === id);
  if (index === -1) return null;
  const number = index + 1;

  return (
    <sup>
      <a
        href={`#footnote-${id}`}
        className="ml-0.5 rounded-sm text-primary underline underline-offset-2"
      >
        <span aria-hidden="true">{number}</span>
        <span className="sr-only">Footnote {number}</span>
      </a>
    </sup>
  );
}
