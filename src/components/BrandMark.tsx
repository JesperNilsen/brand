import { cutForSize } from "@/lib/brand-mark";

type BrandMarkProps = {
  /** Rendered width and height in CSS px. Picks the cut: heavy up to 32 px. */
  size?: number;
  /** Gives the mark an accessible name. Without it the mark is decorative. */
  title?: string;
  className?: string;
};

/**
 * BRAND's mark, drawn in `currentColor` so it takes the ink of whatever it
 * sits in. Decorative by default: next to the wordmark it would otherwise be
 * announced twice. See D19 and «Identitet» in DESIGN.md.
 */
export function BrandMark({ size = 22, title, className }: BrandMarkProps) {
  const cut = cutForSize(size);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={cut.strokeWidth}
      strokeLinecap="butt"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <g transform={`translate(${cut.dx} ${cut.dy})`}>
        {cut.paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
