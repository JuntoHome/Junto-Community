import Link from "next/link";
import type { ReactNode } from "react";
import type { RichText as RichTextValue } from "@/lib/content/types";

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      return href.startsWith("/") ? (
        <Link key={i} href={href} className="font-semibold">
          {label}
        </Link>
      ) : (
        <a key={i} href={href} className="font-semibold">
          {label}
        </a>
      );
    }
    return part;
  });
}

/** Renders one line of inline rich text (`*em*`, `**strong**`, `[label](href)`) without a wrapper. */
export function RichText({ value }: { value: RichTextValue }) {
  return <>{renderInline(value)}</>;
}

/**
 * Renders a list of blocks. A block starting with `## ` becomes a subhead;
 * anything else becomes a paragraph.
 */
export function RichTextBlocks({
  blocks,
  paragraphClassName,
  headingClassName = "font-serif text-2xl font-bold text-navy md:text-3xl",
}: {
  blocks: RichTextValue[];
  paragraphClassName?: string;
  headingClassName?: string;
}) {
  return (
    <>
      {blocks.map((block, i) =>
        block.startsWith("## ") ? (
          <h2 key={i} className={headingClassName}>
            {renderInline(block.slice(3))}
          </h2>
        ) : (
          <p key={i} className={paragraphClassName}>
            {renderInline(block)}
          </p>
        ),
      )}
    </>
  );
}
