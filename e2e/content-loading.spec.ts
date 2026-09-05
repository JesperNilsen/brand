import { expect, test } from "@playwright/test";

const EDITION_URL = "**/content/editions/*.json";

test.describe("The corpus is fetched, so it can fail", () => {
  test("no edition text is served with the page itself", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/content/editions/")) requests.push(r.url());
    });

    await page.goto("/skriv?mode=passage&work=ibsen-brand&segment=akt1-01&filter=as-printed");
    await expect(page.getByTestId("typing-input")).toBeVisible();

    // Exactly the edition being typed, and nothing else: the other three works
    // stay on the server until someone asks for them.
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("ibsen-brand.training.v1");

    // Cacheable forever, because the filename carries the content hash.
    const response = await page.request.get(requests[0]!);
    expect(response.headers()["cache-control"]).toContain("immutable");
  });

  test("a failed text load blocks the session and offers a retry", async ({ page }) => {
    // Fail the fetch, so the page has a work and an edition but no text.
    await page.route(EDITION_URL, (route) => route.abort("failed"));
    await page.goto("/skriv?mode=passage&work=ibsen-brand&segment=akt1-01&filter=as-printed");

    await expect(page.getByTestId("session-error")).toContainText("Teksten kunne ikke lastes");
    // The writing surface must not exist at all. A focused field with nothing
    // to type against would take keystrokes and measure them against nothing.
    await expect(page.getByTestId("typing-input")).toHaveCount(0);

    await page.unroute(EDITION_URL);
    await page.getByTestId("retry-button").click();

    await expect(page.getByTestId("typing-input")).toBeVisible();
    await expect(page.getByTestId("session-error")).toHaveCount(0);
    // The retry starts a real session, not a broken shell.
    await expect(page.getByTestId("session-meta")).toContainText("Brand Training Edition");
  });

  test("a work whose text will not load is never offered as startable", async ({ page }) => {
    await page.route(EDITION_URL, (route) => route.abort("failed"));
    await page.goto("/velg/passage?work=ibsen-brand");

    await expect(page.getByTestId("choose-error")).toContainText("Teksten kunne ikke lastes");
    // No passage links to click, rather than links that lead to a dead session.
    await expect(page.locator("ul.grid a")).toHaveCount(0);

    await page.unroute(EDITION_URL);
    await page.getByTestId("retry-button").click();
    await expect(page.locator("ul.grid a").first()).toBeVisible();
  });

  test("an edition is fetched once per visit, not once per navigation", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/content/editions/")) requests.push(r.url());
    });

    await page.goto("/velg/passage?work=ibsen-brand");
    await expect(page.locator("ul.grid a").first()).toBeVisible();
    await page.locator("ul.grid a").first().click();
    await expect(page.getByTestId("typing-input")).toBeVisible();

    expect(requests).toHaveLength(1);
  });
});
