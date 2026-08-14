import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const PAGE_SUFFIX = "/app/page.tsx";

export async function loadCurrentMetricsEngine() {
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "expose-v18-characterization-targets",
        enforce: "pre",
        transform(source, id) {
          if (!id.endsWith(PAGE_SUFFIX)) return null;
          return source.replace(
            "function buildMetrics(",
            "export function buildMetrics(",
          );
        },
      },
      react(),
    ],
    root: new URL("../", import.meta.url).pathname,
    server: { middlewareMode: true },
  });

  try {
    const [module, data, domain, phase2, uiFormat] = await Promise.all([
      server.ssrLoadModule("/app/page.tsx"),
      server.ssrLoadModule("/app/data.ts"),
      server.ssrLoadModule("/domain/metrics/index.ts"),
      server.ssrLoadModule("/app/phase2-data.ts"),
      server.ssrLoadModule("/app/ui-format.ts"),
    ]);
    return {
      buildMetrics: module.buildMetrics,
      display: uiFormat.display,
      domain,
      formatSignalNumber: domain.formatSignalNumber,
      data,
      phase2,
      close: () => server.close(),
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

export async function withCurrentMetricsEngine(callback) {
  const engine = await loadCurrentMetricsEngine();
  try {
    return await callback(engine);
  } finally {
    await engine.close();
  }
}
