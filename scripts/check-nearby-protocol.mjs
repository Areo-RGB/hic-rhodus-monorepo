import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const protocolPath = path.join(
  rootDir,
  "packages",
  "nearby-protocol",
  "protocol.json",
);

const appConfigs = [
  {
    name: "display",
    filePath: path.join(
      rootDir,
      "apps",
      "display",
      "app",
      "src",
      "main",
      "java",
      "com",
      "example",
      "NearbyManager.kt",
    ),
  },
  {
    name: "controller",
    filePath: path.join(
      rootDir,
      "apps",
      "controller",
      "app",
      "src",
      "main",
      "java",
      "com",
      "example",
      "NearbyManager.kt",
    ),
  },
];

function extractMatch(source, regex, label, appName) {
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Could not find ${label} in ${appName} NearbyManager.kt`);
  }

  return match[1];
}

try {
  const protocol = JSON.parse(await readFile(protocolPath, "utf8"));
  const expectedServiceLine = `private const val SERVICE_ID = "${protocol.serviceId}"`;
  const expectedStrategyToken = `Strategy.${protocol.strategy}`;
  let hasMismatch = false;

  for (const app of appConfigs) {
    let source;

    try {
      source = await readFile(app.filePath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw new Error(`Missing Nearby manager for ${app.name}: ${app.filePath}`);
      }

      throw error;
    }

    const observedServiceId = extractMatch(
      source,
      /private const val SERVICE_ID = "([^"]+)"/,
      "service ID",
      app.name,
    );
    const observedStrategy = extractMatch(
      source,
      /Strategy\.([A-Z0-9_]+)/,
      "strategy",
      app.name,
    );

    console.log(`[${app.name}] expected serviceId: ${protocol.serviceId}`);
    console.log(`[${app.name}] observed serviceId: ${observedServiceId}`);
    console.log(`[${app.name}] expected strategy: ${protocol.strategy}`);
    console.log(`[${app.name}] observed strategy: ${observedStrategy}`);

    const serviceMatches = source.includes(expectedServiceLine);
    const strategyMatches = source.includes(expectedStrategyToken);

    if (!serviceMatches || !strategyMatches) {
      hasMismatch = true;
      const problems = [];

      if (!serviceMatches) {
        problems.push(
          `serviceId mismatch (expected "${protocol.serviceId}", observed "${observedServiceId}")`,
        );
      }

      if (!strategyMatches) {
        problems.push(
          `strategy mismatch (expected "${protocol.strategy}", observed "${observedStrategy}")`,
        );
      }

      console.error(`[${app.name}] ${problems.join("; ")}`);
    }
  }

  if (hasMismatch) {
    process.exitCode = 1;
    console.error("Nearby protocol drift detected.");
  } else {
    console.log("Nearby protocol matches both native managers.");
  }
} catch (error) {
  process.exitCode = 1;
  console.error(
    `Nearby protocol check failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}
