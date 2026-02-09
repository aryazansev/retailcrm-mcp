import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { homedir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(homedir(), "retailcrm-mcp", ".env");
config({ path: envPath });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RetailCRMClient } from "./client.js";

const RETAILCRM_URL = process.env.RETAILCRM_URL || "";
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || "";

if (!RETAILCRM_URL || !RETAILCRM_API_KEY) {
  console.error("Error: RETAILCRM_URL and RETAILCRM_API_KEY must be set");
  console.error("Create .env file in ~/retailcrm-mcp/ with:");
  console.error("RETAILCRM_URL=https://your-account.retailcrm.ru");
  console.error("RETAILCRM_API_KEY=your_api_key");
  process.exit(1);
}

const client = new RetailCRMClient(RETAILCRM_URL, RETAILCRM_API_KEY);

const server = new McpServer({
  name: "retailcrm-mcp",
  version: "1.0.0",
});

// Инструмент: получить список заказов
server.tool(
  "get_orders",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getOrders({ limit, page, filter });
    const simplified = {
      success: result.success,
      pagination: result.pagination,
      orders: (result.orders || []).map((order: any) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        createdAt: order.createdAt,
        totalSumm: order.totalSumm,
        customer: order.customer ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || "Unknown" : "Unknown",
        email: order.customer?.email || null,
        phone: order.customer?.phones?.[0]?.number || null,
      })),
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(simplified, null, 2),
        },
      ],
    };
  }
);

// Инструмент: получить заказ по ID
server.tool(
  "get_order",
  {
    id: z.number().describe("ID заказа"),
  },
  async ({ id }) => {
    const result = await client.getOrder(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Инструмент: создать заказ
server.tool(
  "create_order",
  {
    order: z.record(z.any()).describe("Данные заказа"),
  },
  async ({ order }) => {
    const result = await client.createOrder(order);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Инструмент: получить список клиентов
server.tool(
  "get_customers",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getCustomers({ limit, page, filter });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Инструмент: получить клиента по ID
server.tool(
  "get_customer",
  {
    id: z.number().describe("ID клиента"),
  },
  async ({ id }) => {
    const result = await client.getCustomer(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Инструмент: получить список товаров
server.tool(
  "get_products",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getProducts({ limit, page, filter });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Инструмент: получить товар по ID
server.tool(
  "get_product",
  {
    id: z.number().describe("ID товара"),
  },
  async ({ id }) => {
    const result = await client.getProduct(id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Запуск сервера
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RetailCRM MCP Server running on stdio");
}

main().catch(console.error);
