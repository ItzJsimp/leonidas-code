import type { AnswerBlock } from "@t3tools/shared/answerBlocks";

type ChartData = Extract<AnswerBlock, { type: "chart" }>;

const WIDTH = 320;
const HEIGHT = 160;
const PAD = 8;

/** Opacity steps keep donut slices apart with one theme color; the legend names each slice. */
const sliceOpacity = (index: number) => 1 - (index % 5) * 0.18;

const formatValue = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function BarChart({ labels, values }: ChartData) {
  const max = Math.max(...values, 0) || 1;
  const slot = (WIDTH - PAD * 2) / values.length;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-40 w-full" role="img" aria-hidden>
      {values.map((value, index) => {
        const height = (Math.max(value, 0) / max) * (HEIGHT - PAD * 2);
        return (
          <rect
            key={labels[index]}
            x={PAD + index * slot + slot * 0.15}
            y={HEIGHT - PAD - height}
            width={slot * 0.7}
            height={height}
            rx={2}
            className="fill-primary"
          />
        );
      })}
    </svg>
  );
}

function LineChart({ values }: ChartData) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  const points = values
    .map((value, index) => {
      const x = values.length > 1 ? PAD + index * step : WIDTH / 2;
      const y = HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-40 w-full" role="img" aria-hidden>
      <polyline
        points={points}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        className="stroke-primary"
      />
    </svg>
  );
}

function DonutChart({ labels, values }: ChartData) {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
  const radius = 15.9155; // circumference of 100 keeps dash math in percent
  let offset = 25;
  return (
    <svg viewBox="0 0 42 42" className="size-40 shrink-0" role="img" aria-hidden>
      {values.map((value, index) => {
        const share = (Math.max(value, 0) / total) * 100;
        const slice = (
          <circle
            key={labels[index]}
            cx={21}
            cy={21}
            r={radius}
            fill="none"
            strokeWidth={6}
            strokeDasharray={`${share} ${100 - share}`}
            strokeDashoffset={offset}
            className="stroke-primary"
            strokeOpacity={sliceOpacity(index)}
          />
        );
        offset -= share;
        return slice;
      })}
    </svg>
  );
}

export function ChartBlock({ block }: { block: ChartData }) {
  const total = block.values.reduce((sum, value) => sum + Math.max(value, 0), 0);
  const empty = block.values.length === 0 || (block.kind === "donut" && total === 0);
  const summary = block.labels
    .map((label, index) => `${label}: ${formatValue(block.values[index] ?? 0)}`)
    .join(", ");

  return (
    <figure
      className="my-2 rounded-lg border border-border/60 px-3 py-2"
      data-answer-block="chart"
      aria-label={`${block.title ?? "Chart"}. ${summary}`}
    >
      {block.title ? (
        <figcaption className="mb-1 text-sm font-medium">{block.title}</figcaption>
      ) : null}
      {empty ? (
        <div className="py-4 text-sm text-muted-foreground">No data to chart.</div>
      ) : (
        <div className={block.kind === "donut" ? "flex flex-wrap items-center gap-4" : ""}>
          {block.kind === "bar" ? <BarChart {...block} /> : null}
          {block.kind === "line" ? <LineChart {...block} /> : null}
          {block.kind === "donut" ? <DonutChart {...block} /> : null}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {block.labels.map((label, index) => (
              <li key={label} className="flex items-center gap-1.5">
                {block.kind === "donut" ? (
                  <span
                    className="inline-block size-2 rounded-full bg-primary"
                    style={{ opacity: sliceOpacity(index) }}
                  />
                ) : null}
                <span>{label}</span>
                <span className="font-medium text-foreground">
                  {formatValue(block.values[index] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
