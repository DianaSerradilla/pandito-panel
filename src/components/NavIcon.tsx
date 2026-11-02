/**
 * Line icons for the sidebar. The brand manual has no interface icon set, so these are plain
 * geometric strokes (round caps, same weight) that take the text color of their link.
 */
const paths = {
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  sales: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6'],
  events: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  requests: ['M3 13l3-8h12l3 8v6H3z', 'M3 13h5l1 2h6l1-2h5'],
  stock: ['M3 8l9-5 9 5v8l-9 5-9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
  production: ['M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2', 'M7 14h10v7H7z', 'M7 7V3h10v4'],
  prices: ['M3 12V4h8l10 10-8 8z', 'M7.5 8.5h.01'],
  promos: ['M5 19L19 5', 'M9 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z', 'M19 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'],
  delivery: ['M2 6h11v10H2z', 'M13 9h4l4 4v3h-8', 'M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z', 'M19 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'],
  catalog: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  downloads: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 20h16'],
  activity: ['M3 12h4l3-8 4 16 3-8h4'],
  topics: ['M5 9h15', 'M4 15h15', 'M10 3L8 21', 'M16 3l-2 18'],
} as const

export type IconName = keyof typeof paths

export function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
