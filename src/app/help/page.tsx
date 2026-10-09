import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { HELP_TOPICS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Help",
  description: "Questions and answers about Soothe Spaces.",
};

export default function HelpPage() {
  return (
    <ContentPage
      title="Questions and answers"
      intro="How Soothe Spaces works, where its information comes from, and what happens to your check-ins."
    >
      <nav aria-labelledby="help-topics" className="flex flex-col gap-2">
        <h2 id="help-topics" className="text-xl">
          Topics
        </h2>
        <ul className="flex flex-col gap-1">
          {HELP_TOPICS.map((topic) => (
            <li key={topic.id}>
              <Link
                href={`#${topic.id}`}
                className="rounded-sm text-primary underline underline-offset-4"
              >
                {topic.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {HELP_TOPICS.map((topic) => (
        <section
          key={topic.id}
          id={topic.id}
          aria-labelledby={`${topic.id}-heading`}
          className="flex scroll-mt-4 flex-col gap-4"
        >
          <h2 id={`${topic.id}-heading`} className="text-2xl">
            {topic.title}
          </h2>
          <dl className="flex flex-col gap-4">
            {topic.questions.map((item) => (
              <div key={item.question} className="flex flex-col gap-1">
                <dt className="font-semibold">{item.question}</dt>
                <dd className="text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </ContentPage>
  );
}
