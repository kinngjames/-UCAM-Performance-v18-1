import { createServer } from "vite";

export async function loadCurrentMetricsEngine() {
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root: new URL("../", import.meta.url).pathname,
    server: {
      middlewareMode: true,
      watch: {
        ignored: [
          "**/.git/**",
          "**/.next/**",
          "**/.sites-runtime/**",
          "**/dist/**",
        ],
      },
    },
  });

  try {
    const [data, domain, monitoringStatus, phase2, sessionPlan, uiFormat] = await Promise.all([
      server.ssrLoadModule("/app/data.ts"),
      server.ssrLoadModule("/domain/metrics/index.ts"),
      server.ssrLoadModule("/app/monitoring-status.tsx"),
      server.ssrLoadModule("/app/phase2-data.ts"),
      server.ssrLoadModule("/app/session-plan.ts"),
      server.ssrLoadModule("/app/ui-format.ts"),
    ]);
    return {
      buildMetrics: domain.buildMetrics,
      display: uiFormat.display,
      domain,
      formatSignalNumber: domain.formatSignalNumber,
      monitoringStatus,
      data,
      phase2,
      sessionPlan,
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
