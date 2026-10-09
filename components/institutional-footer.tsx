export function InstitutionalFooter({ currentYear }: { currentYear: number }) {
  return (
    <footer className="institutional-footer">
      <nav aria-label="Footer navigation">
        <a href="/corpus">Corpus</a><span aria-hidden="true"> | </span>
        <a href="/compare">Compare</a><span aria-hidden="true"> | </span>
        <a href="/analytics">Analytics</a><span aria-hidden="true"> | </span>
        <a href="/plan">Plan</a><span aria-hidden="true"> | </span>
        <a href="/about">About</a><span aria-hidden="true"> | </span>
        <a href="/guide">Documentation</a>
      </nav>
      <p className="institutional-funding">This project was funded by the UCSF Program for Breakthrough Biomedical Research, funded in part by the Sandler Foundation.</p>
      <p className="institutional-funding">Additional support: National Institute of General Medical Sciences, National Institutes of Health, award R35GM130327. The content is solely the responsibility of the authors and does not necessarily represent the official views of the National Institutes of Health.</p>
      <small>© {currentYear} General Cell Anatomy Group<span className="institutional-motto">Ad Interiora.</span></small>
    </footer>
  );
}
