import { config, hasModelConfig } from "./config.js";
import { logger } from "./logger.js";

function extractTextFromMessage(message) {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
  }

  return "";
}

function buildMockDecision(messages) {
  const lastUserMessage = [...messages].reverse().find((item) => item.role === "user");
  const lastToolMessage = [...messages].reverse().find((item) => item.role === "tool");
  const input = extractTextFromMessage(lastUserMessage).toLowerCase();

  logger.warn("model.mock_mode.active", {
    reason: "MODEL_API_KEY / MODEL_BASE_URL / MODEL_NAME is missing",
  });

  // When a tool has already run, mock mode returns a final summary instead of looping forever.
  if (lastToolMessage) {
    return {
      role: "assistant",
      content: `Mock mode summary:\n${extractTextFromMessage(lastToolMessage)}`,
    };
  }

  if (input.includes("时间")) {
    return {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "mock-tool-time",
          type: "function",
          function: {
            name: "get_current_time",
            arguments: "{}",
          },
        },
      ],
    };
  }

  const addMatch = input.match(/(\d+)\s*\+\s*(\d+)/);
  if (addMatch) {
    return {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "mock-tool-add",
          type: "function",
          function: {
            name: "add_numbers",
            arguments: JSON.stringify({
              a: Number(addMatch[1]),
              b: Number(addMatch[2]),
            }),
          },
        },
      ],
    };
  }

  return {
    role: "assistant",
    content:
      "This is a mock response. Configure MODEL_API_KEY, MODEL_BASE_URL and MODEL_NAME to connect a real model provider.",
  };
}

export async function createAssistantMessage(messages, tools) {
  if (!hasModelConfig()) {
    return buildMockDecision(messages);
  }

  logger.info("model.request.start", {
    modelName: config.modelName,
    messageCount: messages.length,
  });

  const response = await fetch(`${config.modelBaseUrl}${config.modelApiPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.modelApiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("model.request.failed", {
      status: response.status,
      errorText,
    });
    throw new Error(`Model request failed with status ${response.status}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;

  if (!message) {
    logger.error("model.response.invalid", { data });
    throw new Error("Model response does not contain a valid assistant message");
  }

  logger.info("model.request.finish", {
    usedTools: Array.isArray(message.tool_calls) ? message.tool_calls.length : 0,
  });

  return message;
}
