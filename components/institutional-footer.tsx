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
      <div className="institutional-funding" aria-label="Funding">
        <a className="institutional-funding-text" href="/about#funding">
          <strong>Funded by</strong>
          <span>UCSF PBBR / Sandler Foundation</span>
          <span>NIH/NIGMS R35GM130327</span>
        </a>
        <a className="institutional-funding-logo" href="/about#funding">
          <img src="/brand/nih-emblem.png" alt="National Institutes of Health" width="81" height="52" />
        </a>
      </div>
      <small>© {currentYear} General Cell Anatomy Group<span className="institutional-motto">Ad Interiora.</span></small>
    </footer>
  );
}
