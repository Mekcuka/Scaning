/** Custom map icon for ИЭ (источник энергии) and all subtypes (ГТЭС / ГПЭС / ВИЭС). */

type MapIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function svgProps({ size = 22, color = 'currentColor', strokeWidth = 2 }: MapIconProps) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** ИЭ — круг + молния; цвет задаётся подтипом (gtes / gpes / vies). */
export function IeMapIcon(props: MapIconProps) {
  const { color = 'currentColor', strokeWidth = 2 } = props;
  const p = svgProps(props);
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path
        d="M13 6.5 10 12.5h2.5l-1.25 4.25 4.25-6.25H12.75L13 6.5z"
        fill={color}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}
