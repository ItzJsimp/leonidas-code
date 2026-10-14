import type { TaskBoardHomeNewsItem } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { describeWeather, parseFeed, pickNews } from "./homeFeeds.ts";

const item = (source: string, at: string, title = `${source} ${at}`): TaskBoardHomeNewsItem => ({
  title,
  link: `https://example.com/${encodeURIComponent(title)}`,
  image: null,
  at,
  summary: "",
  source,
});

describe("parseFeed", () => {
  it("reads RSS items with CDATA titles, entities and a media image", () => {
    const xml = `<rss><channel>
      <item><title><![CDATA[Model &amp; agents ship]]></title><link>https://news.test/a</link>
        <pubDate>Tue, 14 Oct 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Short summary&lt;/p&gt;</description>
        <media:content url="https://img.test/a.jpg?w=1&amp;h=2" /></item>
      <item><title>No link</title></item>
    </channel></rss>`;
    expect(parseFeed(xml, "Test")).toEqual([
      {
        title: "Model & agents ship",
        link: "https://news.test/a",
        image: "https://img.test/a.jpg?w=1&h=2",
        at: "2026-10-14T10:00:00.000Z",
        summary: "Short summary",
        source: "Test",
      },
    ]);
  });

  it("reads Atom entries with an href link and drops non-https links", () => {
    const xml = `<feed>
      <entry><title>Atom post</title><link href="https://atom.test/p"/><updated>2026-10-13T08:00:00Z</updated></entry>
      <entry><title>Plain http</title><link href="http://atom.test/q"/></entry>
    </feed>`;
    const items = parseFeed(xml, "Atom");
    expect(items.map((entry) => entry.title)).toEqual(["Atom post"]);
    expect(items[0]?.at).toBe("2026-10-13T08:00:00.000Z");
  });
});

describe("pickNews", () => {
  it("keeps the newest five with at most two per source", () => {
    const picked = pickNews([
      item("A", "2026-10-14T05:00:00Z"),
      item("A", "2026-10-14T04:00:00Z"),
      item("A", "2026-10-14T03:00:00Z"),
      item("B", "2026-10-14T02:00:00Z"),
      item("B", "2026-10-14T01:00:00Z"),
      item("C", "2026-10-13T23:00:00Z"),
      item("C", "2026-10-13T22:00:00Z"),
    ]);
    expect(picked).toHaveLength(5);
    expect(picked.filter((entry) => entry.source === "A")).toHaveLength(2);
    expect(picked[0]?.at).toBe("2026-10-14T05:00:00Z");
  });
});

describe("describeWeather", () => {
  it("maps WMO codes and shows a moon for clear nights", () => {
    expect(describeWeather(61, true)).toEqual({ condition: "Rain", icon: "cloud-rain" });
    expect(describeWeather(0, false)).toEqual({ condition: "Clear", icon: "moon" });
    expect(describeWeather(999, true)).toEqual({ condition: "Unknown", icon: "cloud" });
  });
});
