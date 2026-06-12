import { logger } from "./logger.js";

const demoDocs = [
  "Agent = Prompt + Model + Tool/Skill + Runtime + Memory + Channel",
  "Prompt is the instruction and context sent together with the user input.",
  "Tools are predefined capabilities implemented by the program.",
  "The model decides what to do next, but the program performs the real execution.",
];

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "search_demo_docs",
      description: "Search the built-in demo knowledge base with a keyword.",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "Keyword used to search the demo docs.",
          },
        },
        required: ["keyword"],
      },
    },
  },
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
];

const toolHandlers = {
  async search_demo_docs({ keyword }) {
    const normalized = String(keyword || "").toLowerCase().trim();

    logger.info("tools.search_demo_docs.start", { keyword: normalized });

    const matches = demoDocs.filter((item) => item.toLowerCase().includes(normalized));
    const result =
      matches.length > 0 ? matches.join("\n") : `No demo documents matched keyword: ${normalized}`;

    logger.info("tools.search_demo_docs.finish", { matchCount: matches.length });

    return result;
  },

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
