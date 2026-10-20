export function WhatsHere({ labels }: { labels: readonly string[] }) {
  if (labels.length === 0) return null;
  return (
    <section aria-labelledby="space-whats-here" className="flex flex-col gap-2">
      <h2 id="space-whats-here" className="text-base">
        What&apos;s here
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <li key={label} className="rounded-full border border-border px-3 py-1 text-sm">
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
