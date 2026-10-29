/**
 * Splits a profile's long text, as typed in /admin, into the blocks `RichTextBlocks`
 * renders: a blank line starts a new paragraph, and a line starting with "- " (or "* ",
 * "• ") is a bullet point. Inline **bold**, *italic* and [links](https://...) carry through.
 */
export function toBlocks(text: string): string[] {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) blocks.push(paragraph.join(" "));
    paragraph = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (!line) {
      endParagraph();
    } else if (bullet) {
      endParagraph();
      blocks.push(`- ${bullet[1]}`);
    } else {
      paragraph.push(line);
    }
  }
  endParagraph();
  return blocks;
}
