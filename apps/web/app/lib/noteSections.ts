// Bill notes are stored as plain text; a line starting with "## " marks a section heading
// (e.g. "## Terms & Conditions"). Old notes without headings keep working as plain text.
export interface NoteSection {
  heading: string;
  body: string;
}

const HEADING = /^##\s+(.*)$/;

export function parseNoteSections(text: string): NoteSection[] {
  const sections: NoteSection[] = [];
  let current: NoteSection | null = null;
  for (const line of (text || '').split('\n')) {
    const m = line.match(HEADING);
    if (m) {
      current = { heading: m[1].trim(), body: '' };
      sections.push(current);
    } else {
      if (!current) {
        current = { heading: '', body: '' };
        sections.push(current);
      }
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  return sections
    .map((s) => ({ heading: s.heading, body: s.body.trim() }))
    .filter((s) => s.heading || s.body);
}

export function composeNoteSections(sections: NoteSection[]): string {
  // Headings are kept even with an empty body so section order stays stable while editing.
  return sections
    .filter((s) => s.heading.trim() || s.body.trim())
    .map((s) => (s.heading.trim() ? `## ${s.heading.trim()}\n${s.body.trim()}`.trim() : s.body.trim()))
    .join('\n\n');
}
