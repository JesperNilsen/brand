import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineChart, type LineChartProps } from "@/components/charts/LineChart";
import { formatClock, formatNumber } from "@/lib/format";

const props: LineChartProps = {
  title: "Hastighet gjennom økten",
  x: [1000, 2000, 3000, 4000, 5000],
  xLabel: "Tid",
  formatX: formatClock,
  formatY: (v) => formatNumber(v),
  series: [
    { id: "net", label: "Netto WPM", endLabel: "Netto", tone: "accent", values: [12, 30, 36.4, 40, 41.2] },
    { id: "raw", label: "Rå WPM", endLabel: "Rå", tone: "muted", dashed: true, values: [24, 72, 48, 60, 48] },
  ],
  marks: { label: "Feil", values: [0, 2, 0, 1, 0] },
};

function render(p: LineChartProps) {
  const html = renderToStaticMarkup(createElement(LineChart, p));
  return new JSDOM(`<body>${html}</body>`).window.document;
}

describe("LineChart", () => {
  it("is a figure whose svg is an image with a title and a desc that says the data in words", () => {
    const doc = render(props);
    const svg = doc.querySelector("figure > svg[role='img']");
    expect(svg).not.toBeNull();
    const title = svg!.querySelector("title");
    const desc = svg!.querySelector("desc");
    expect(title?.textContent).toBe("Hastighet gjennom økten");
    expect(desc?.textContent).toBe(
      "Tid 0:01–0:05. " +
        "Netto WPM: slutter på 41, høyest 41 ved 0:05, lavest 12 ved 0:01. " +
        "Rå WPM: slutter på 48, høyest 72 ved 0:02, lavest 24 ved 0:01. " +
        "Feil: 3 i alt, i 2 av 5 målepunkter.",
    );
    const labelled = svg!.getAttribute("aria-labelledby")!.split(" ");
    expect(labelled).toEqual([title!.id, desc!.id]);
  });

  it("has a «Som tabell» version with one row per point, in the same formatting", () => {
    const doc = render(props);
    const details = doc.querySelector("figure details");
    expect(details?.querySelector("summary")?.textContent).toBe("Som tabell");
    const head = [...details!.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(head).toEqual(["Tid", "Netto WPM", "Rå WPM", "Feil"]);
    const rows = [...details!.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent),
    );
    expect(rows).toHaveLength(5);
    expect(rows[1]).toEqual(["0:02", "30", "72", "2"]);
    expect(rows.at(-1)).toEqual(["0:05", "41", "48", "0"]);
  });

  it("tells series apart by dash and by a label at the line's end, not by colour alone", () => {
    const doc = render(props);
    const net = doc.querySelector("[data-series='net']")!;
    const raw = doc.querySelector("[data-series='raw']")!;
    expect(net.getAttribute("stroke-dasharray")).toBeNull();
    expect(raw.getAttribute("stroke-dasharray")).not.toBeNull();
    const ends = [...doc.querySelectorAll("svg [data-end-label]")].map((t) => t.textContent);
    expect(ends).toEqual(["Netto 41", "Rå 48"]);
  });

  it("marks errors with «×», one per point that has any", () => {
    const doc = render(props);
    const marks = [...doc.querySelectorAll("svg [data-mark]")];
    expect(marks.map((m) => m.textContent)).toEqual(["×", "×"]);
  });

  it("says so in words when there is nothing to draw", () => {
    const doc = render({ ...props, x: [], series: props.series.map((s) => ({ ...s, values: [] })), marks: { label: "Feil", values: [] } });
    expect(doc.querySelector("desc")?.textContent).toBe("Ingen målepunkter.");
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(0);
  });
});
