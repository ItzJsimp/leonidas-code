import { assert, it } from "vite-plus/test";

import { renderSnipOverlayPage } from "./SnipOverlayPage.ts";

it("builds a page that loads the frozen frame and forwards pointer events", () => {
  const html = renderSnipOverlayPage({
    displayId: 2,
    frameFile: "frame-2.jpg",
    originX: 1920,
    originY: 0,
    scaleFactor: 1.5,
  });
  assert.include(html, 'src="frame-2.jpg"');
  assert.include(html, '"originX":1920');
  assert.include(html, '"scale":1.5');
  assert.include(html, 'addEventListener("keydown"');
  assert.notInclude(html, "—");
});

it("keeps a script tag in the config from breaking out of the page", () => {
  const html = renderSnipOverlayPage({
    displayId: 1,
    frameFile: "frame-1.jpg",
    originX: 0,
    originY: 0,
    scaleFactor: 1,
  });
  assert.strictEqual(html.split("</script>").length, 2);
});
