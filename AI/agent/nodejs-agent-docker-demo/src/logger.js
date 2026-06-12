function formatMeta(meta = {}) {
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return "";
  }

  return ` ${JSON.stringify(Object.fromEntries(entries))}`;
}

function log(level, message, meta) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} [${level}] ${message}${formatMeta(meta)}`;
  console.log(line);
}

export const logger = {
  info(message, meta) {
    log("INFO", message, meta);
  },

  warn(message, meta) {
    log("WARN", message, meta);
  },

  error(message, meta) {
    log("ERROR", message, meta);
  },
};
