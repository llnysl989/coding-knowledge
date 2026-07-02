import dotenv from "dotenv";

dotenv.config();

function requireTrimmed(value) {
  if (!value) {
    return "";
  }

  return value.trim();
}

export const config = {
  port: Number.parseInt(process.env.PORT || "3000", 10),
  logLevel: requireTrimmed(process.env.LOG_LEVEL || "info"),
  modelApiKey: requireTrimmed(process.env.MODEL_API_KEY),
  modelBaseUrl: requireTrimmed(process.env.MODEL_BASE_URL),
  modelName: requireTrimmed(process.env.MODEL_NAME),
  modelApiPath: requireTrimmed(process.env.MODEL_API_PATH || "/chat/completions"),
};

export function hasModelConfig() {
  return Boolean(config.modelApiKey && config.modelBaseUrl && config.modelName);
}
