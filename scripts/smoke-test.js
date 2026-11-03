const testPort = Number(process.env.SMOKE_TEST_PORT || 3012);

process.env.NODE_ENV = "test";
process.env.HOST = "127.0.0.1";
process.env.PORT = String(testPort);
process.env.APP_BASE_PATH = "/whiteboard";

require("../server");

const baseUrl = `http://127.0.0.1:${testPort}/whiteboard`;

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
      lastError = new Error(`unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error("server did not start");
}

async function check(path, expectedType) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes(expectedType)) {
    throw new Error(`${path}: expected ${expectedType}, received ${contentType || "no content type"}`);
  }
  console.log(`OK ${path} ${response.status} ${contentType}`);
}

(async () => {
  try {
    await waitForServer();
    await check("/", "text/html");
    await check("/d/", "text/html");
    await check("/api/boards?mode=whiteboard", "application/json");
    await check("/api/boards?mode=design", "application/json");
    console.log("Smoke test passed.");
    process.exit(0);
  } catch (error) {
    console.error("Smoke test failed:", error);
    process.exit(1);
  }
})();
