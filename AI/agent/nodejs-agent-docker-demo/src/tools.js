import fs from "node:fs/promises";
import path from "node:path";

import { logger } from "./logger.js";

const workspaceRoot = process.cwd();

function resolveWorkspacePath(filename) {
  const normalized = String(filename || "").trim();

  if (!normalized) {
    throw new Error("filename must be a non-empty relative path");
  }

  if (path.isAbsolute(normalized)) {
    throw new Error("absolute paths are not allowed");
  }

  const targetPath = path.resolve(workspaceRoot, normalized);
  const relativePath = path.relative(workspaceRoot, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("path must stay inside the workspace root");
  }

  return {
    normalized,
    targetPath,
    relativePath: relativePath || path.basename(targetPath),
  };
}

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "add_numbers",
      description: "Add two numbers and return the sum.",
      parameters: {
        type: "object",
        properties: {
          a: {
            type: "number",
            description: "The first number.",
          },
          b: {
            type: "number",
            description: "The second number.",
          },
        },
        required: ["a", "b"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Return the current server time in ISO format.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description:
        "Create a new file inside the current workspace using a safe relative path. Do not use absolute paths.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Relative file path inside the workspace, for example aa.log or notes/todo.md.",
          },
          content: {
            type: "string",
            description: "Optional text content written into the new file.",
          },
        },
        required: ["filename"],
      },
    },
  },
];

const toolHandlers = {
  async add_numbers({ a, b }) {
    logger.info("tools.add_numbers.start", { a, b });
    const sum = Number(a) + Number(b);
    logger.info("tools.add_numbers.finish", { sum });
    return `The sum of ${a} and ${b} is ${sum}.`;
  },

  async get_current_time() {
    const currentTime = new Date().toISOString();
    logger.info("tools.get_current_time.finish", { currentTime });
    return `Current server time: ${currentTime}`;
  },

  async create_file({ filename, content = "" }) {
    logger.info("tools.create_file.start", {
      filename,
      contentLength: typeof content === "string" ? content.length : String(content || "").length,
      workspaceRoot,
    });

    let targetInfo;
    try {
      targetInfo = resolveWorkspacePath(filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("tools.create_file.rejected", { filename, reason: message });
      return `Refused to create file: ${message}`;
    }

    try {
      await fs.mkdir(path.dirname(targetInfo.targetPath), { recursive: true });
      await fs.writeFile(targetInfo.targetPath, String(content || ""), {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        logger.warn("tools.create_file.exists", { filename: targetInfo.relativePath });
        return `File already exists: ${targetInfo.relativePath}`;
      }

      logger.error("tools.create_file.failed", {
        filename: targetInfo.relativePath,
        error: message,
      });
      throw error;
    }

    logger.info("tools.create_file.finish", {
      filename: targetInfo.relativePath,
      targetPath: targetInfo.targetPath,
    });

    return `File created successfully: ${targetInfo.relativePath}`;
  },
};

export async function executeTool(name, rawArguments = "{}") {
  logger.info("tools.execute.start", { name });

  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unsupported tool: ${name}`);
  }

  let parsedArguments = {};
  try {
    parsedArguments = JSON.parse(rawArguments || "{}");
  } catch (error) {
    logger.error("tools.execute.parse_failed", {
      name,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Invalid JSON arguments for tool ${name}`);
  }

  const result = await handler(parsedArguments);
  logger.info("tools.execute.finish", { name });

  return result;
}
