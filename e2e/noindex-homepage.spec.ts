/**
 * The site is not for search engines and points back to its owner's homepage.
 *
 * Both claims are about what a browser or crawler receives, so they are
 * checked against the running server: the X-Robots-Tag header, the robots
 * meta tag, and the footer link on every route.
 */
import { expect, test } from "@playwright/test";

for (const path of ["/", "/om", "/historikk", "/skriv"]) {
  test(`${path} is noindex and links to jespernilsen.com`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "jespernilsen.com" }))
      .toHaveAttribute("href", "https://jespernilsen.com/");
  });
}
