type BrandMarkProps = {
  /** Extra class on the outer row */
  className?: string;
  /** Show the "UniTrack" wordmark next to the badge (default true) */
  showWordmark?: boolean;
};

/** Shared UniTrack monogram badge + optional wordmark (login + sidebar). */
export default function BrandMark({
  className = "",
  showWordmark = true,
}: BrandMarkProps) {
  return (
    <div className={`brand-mark ${className}`.trim()}>
      <span className="brand-mark-badge" aria-hidden>
        UT
      </span>
      {showWordmark ? <span className="brand">UniTrack</span> : null}
    </div>
  );
}
