/**
 * Minimal ambient declaration for the `jsdom` package. This repo has no
 * @types/jsdom (it's a devDependency of the test stack, not typed for
 * scripts), so wikikilden.ts declares just the surface it uses: a JSDOM
 * class whose `.window.document` is a standard DOM Document.
 */
declare module "jsdom" {
  export class JSDOM {
    constructor(html: string);
    window: {
      document: Document;
    };
  }
}
