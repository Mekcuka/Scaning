export function SandFlowEdgeSegmentLabel({
  lx,
  ly,
  label,
  stroke,
}: {
  lx: number;
  ly: number;
  label: string;
  stroke: string;
}) {
  return (
    <g pointerEvents="none" className="sand-flow-edge-label">
      <rect
        x={lx - label.length * 3.2 - 8}
        y={ly - 10}
        width={label.length * 6.4 + 16}
        height={20}
        rx={10}
        fill="var(--surface, #fff)"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="central"
        fill={stroke}
        fontSize={11}
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}
