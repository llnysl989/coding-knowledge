import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
// 美国国家气象局 API 的基础地址。
// 这个案例用它作为天气数据来源。
const NWS_API_BASE = "https://api.weather.gov";
// User-Agent 是许多公共 API 都建议携带的标识信息。
// 真实项目里建议改成你的应用名或团队名。
const USER_AGENT = "weather-mcp-example/1.0";
// 创建 MCP Server 实例。
// 这里的 name 和 version 会在 MCP 初始化阶段暴露给客户端。
const server = new McpServer({
    name: "weather-mcp",
    version: "1.0.0",
});
// =========================
// 二、封装通用请求函数
// =========================
// 这个函数负责向 NWS API 发请求，并统一处理异常。
// 之所以单独封装，是因为多个工具都会复用。
async function makeNWSRequest(url) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };
    try {
        const response = await fetch(url, { headers });
        // 如果 HTTP 状态码不是 2xx，这里主动抛错。
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        // 注意：stdio 模式下不要使用 console.log。
        // 标准输出 stdout 是给 MCP 协议消息使用的，乱写会污染通信通道。
        // 所以调试日志要写到 stderr，也就是 console.error。
        console.error("Error making NWS request:", error);
        return null;
    }
}
// =========================
// 三、封装数据格式化函数
// =========================
// 把单条预警对象格式化成更适合直接展示给模型的文本。
function formatAlert(feature) {
    const props = feature.properties;
    return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
    ].join("\n");
}
// 把单条天气预报格式化成文本。
function formatForecastPeriod(period) {
    return [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature ?? "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`.trim(),
        `${period.shortForecast || "No forecast available"}`,
        "---",
    ].join("\n");
}
// =========================
// 四、注册工具：get-alerts
// =========================
server.registerTool("get-alerts", {
    title: "Get Weather Alerts",
    description: "Get active weather alerts for a US state by its two-letter code",
    inputSchema: z.object({
        state: z
            .string()
            .length(2)
            .describe("Two-letter US state code, such as CA, NY, or TX"),
    }),
}, async ({ state }) => {
    // 统一把州代码转成大写，避免用户传入 ca、tx 之类时出问题。
    const stateCode = state.toUpperCase();
    // NWS 提供按州查询预警的接口。
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest(alertsUrl);
    // 如果请求失败，返回明确的错误提示。
    if (!alertsData) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve weather alerts for state ${stateCode}.`,
                },
            ],
        };
    }
    const features = alertsData.features || [];
    // 没有预警不是错误，是正常情况。
    if (features.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `No active alerts for ${stateCode}.`,
                },
            ],
        };
    }
    const formattedAlerts = features.map(formatAlert).join("\n");
    return {
        content: [
            {
                type: "text",
                text: `Active alerts for ${stateCode}:\n\n${formattedAlerts}`,
            },
        ],
    };
});
// =========================
// 五、注册工具：get-forecast
// =========================
server.registerTool("get-forecast", {
    title: "Get Weather Forecast",
    description: "Get weather forecast for a location by latitude and longitude",
    inputSchema: z.object({
        latitude: z
            .number()
            .min(-90)
            .max(90)
            .describe("Latitude of the location, for example 37.7749"),
        longitude: z
            .number()
            .min(-180)
            .max(180)
            .describe("Longitude of the location, for example -122.4194"),
    }),
}, async ({ latitude, longitude }) => {
    // 第一步不是直接查 forecast，而是先查 points 接口。
    // 因为 NWS 需要先根据经纬度映射到具体的 forecast URL。
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest(pointsUrl);
    if (!pointsData) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve grid point data for coordinates ${latitude}, ${longitude}. The location may be unsupported by the API.`,
                },
            ],
        };
    }
    const forecastUrl = pointsData.properties?.forecast;
    // 如果没拿到 forecast 地址，说明上游返回不完整。
    if (!forecastUrl) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to get forecast URL for coordinates ${latitude}, ${longitude}.`,
                },
            ],
        };
    }
    // 第二步才是真正获取天气预报。
    const forecastData = await makeNWSRequest(forecastUrl);
    if (!forecastData) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve forecast data for coordinates ${latitude}, ${longitude}.`,
                },
            ],
        };
    }
    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `No forecast periods available for coordinates ${latitude}, ${longitude}.`,
                },
            ],
        };
    }
    const formattedForecast = periods.map(formatForecastPeriod).join("\n");
    return {
        content: [
            {
                type: "text",
                text: `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast}`,
            },
        ],
    };
});
// =========================
// 六、启动 server
// =========================
async function main() {
    // stdio transport 表示客户端会通过标准输入输出和当前进程通信。
    const transport = new StdioServerTransport();
    // 建立 MCP 连接，开始监听请求。
    await server.connect(transport);
    // 依然强调：日志写 stderr，不写 stdout。
    console.error("Weather MCP server is running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
