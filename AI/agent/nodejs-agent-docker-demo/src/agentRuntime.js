import { createAssistantMessage } from "./modelClient.js";
import { logger } from "./logger.js";
import { executeTool, toolDefinitions } from "./tools.js";

const SYSTEM_PROMPT = [
  "You are a minimal demo agent.",
  "Your job is to answer user questions and use tools when they can help.",
  "Use search_demo_docs for built-in demo knowledge.",
  "Use add_numbers when the user asks for addition.",
  "Use get_current_time when the user asks for the current time.",
  "Keep your final answer concise and explain whether you used a tool.",
].join(" ");

function buildInitialMessages(userInput) {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: userInput,
    },
  ];
}

export async function runAgent(userInput) {
  const startedAt = Date.now();
  const messages = buildInitialMessages(userInput);

  logger.info("agent.run.start", { userInputLength: userInput.length });

  for (let step = 1; step <= 5; step += 1) {
    logger.info("agent.run.step.start", { step, messageCount: messages.length });

    const assistantMessage = await createAssistantMessage(messages, toolDefinitions);
    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls || [];
    if (toolCalls.length === 0) {
      const answer = assistantMessage.content || "Model returned an empty answer.";
      logger.info("agent.run.finish", {
        step,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        answer,
        steps: step,
        usedTools: [],
      };
    }

    const usedTools = [];
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name || "unknown_tool";
      const toolArgs = toolCall.function?.arguments || "{}";

      logger.info("agent.run.tool_call", { step, toolName });

      const toolResult = await executeTool(toolName, toolArgs);
      usedTools.push(toolName);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }

    const followUpMessage = await createAssistantMessage(messages, toolDefinitions);
    messages.push(followUpMessage);

    logger.info("agent.run.finish", {
      step,
      elapsedMs: Date.now() - startedAt,
      usedTools,
    });

    return {
      answer: followUpMessage.content || "Tool was executed but model returned no final answer.",
      steps: step,
      usedTools,
    };
  }

  throw new Error("Agent stopped because the max step count was reached");
}
