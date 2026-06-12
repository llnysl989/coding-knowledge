import express from "express";

import { runAgent } from "./agentRuntime.js";
import { config, hasModelConfig } from "./config.js";
import { logger } from "./logger.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    modelConfigured: hasModelConfig(),
    service: "nodejs-agent-docker-demo",
  });
});

app.post("/api/chat", async (req, res) => {
  const userInput = String(req.body?.input || "").trim();

  if (!userInput) {
    return res.status(400).json({
      ok: false,
      error: "Request body must contain a non-empty `input` field.",
    });
  }

  logger.info("http.chat.start", {
    inputLength: userInput.length,
    modelConfigured: hasModelConfig(),
  });

  try {
    const result = await runAgent(userInput);

    logger.info("http.chat.finish", {
      usedTools: result.usedTools,
      steps: result.steps,
    });

    return res.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    logger.error("http.chat.failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});

app.listen(config.port, () => {
  logger.info("server.started", {
    port: config.port,
    modelConfigured: hasModelConfig(),
  });
});
