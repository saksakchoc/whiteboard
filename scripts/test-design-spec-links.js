const assert = require("assert/strict");
const {
  requestPublicBaseUrl,
  absoluteResourceUrl,
  absoluteLinksInText,
  absolutizeSpecValue,
} = require("../lib/design-spec-links");

const publicBaseUrl = "https://saksak.tokyo/whiteboard";

assert.equal(
  requestPublicBaseUrl({
    protocol: "http",
    get(name) {
      return {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "saksak.tokyo",
        host: "127.0.0.1:3001",
      }[name.toLowerCase()] || "";
    },
  }, "/whiteboard"),
  publicBaseUrl,
);

assert.equal(
  absoluteResourceUrl("/whiteboard/uploads/board/image.png", publicBaseUrl),
  "https://saksak.tokyo/whiteboard/uploads/board/image.png",
);
assert.equal(
  absoluteResourceUrl("uploads/board/image.png", publicBaseUrl),
  "https://saksak.tokyo/whiteboard/uploads/board/image.png",
);
assert.equal(
  absoluteResourceUrl("https://example.com/image.png", publicBaseUrl),
  "https://example.com/image.png",
);

assert.equal(
  absoluteLinksInText(
    "画像: [確認](/whiteboard/uploads/board/a.png)\n参考: uploads/board/b.png",
    publicBaseUrl,
  ),
  "画像: [確認](https://saksak.tokyo/whiteboard/uploads/board/a.png)\n参考: https://saksak.tokyo/whiteboard/uploads/board/b.png",
);

assert.deepEqual(
  absolutizeSpecValue({
    imageSrc: "/whiteboard/uploads/board/a.png",
    memo: "HTML: <img src='/whiteboard/uploads/board/b.png'>",
    externalUrl: "https://example.com/",
  }, publicBaseUrl),
  {
    imageSrc: "https://saksak.tokyo/whiteboard/uploads/board/a.png",
    memo: "HTML: <img src='https://saksak.tokyo/whiteboard/uploads/board/b.png'>",
    externalUrl: "https://example.com/",
  },
);

console.log("Design spec absolute-link tests passed.");
