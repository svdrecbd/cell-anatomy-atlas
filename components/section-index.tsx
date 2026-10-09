type SectionIndexProps = { entries: ReadonlyArray<{ id: string; label: string }> };

export function SectionIndex({ entries }: SectionIndexProps) {
  return (
    <nav className="section-index" aria-label="On this page">
      <span>Contents</span>
      <ul>{entries.map(entry => <li key={entry.id}><a href={`#${entry.id}`}>{entry.label}</a></li>)}</ul>
    </nav>
  );
}
