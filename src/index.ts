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

// Only check env vars when NOT using test server
if (!process.argv.includes('test-server.js') && (!RETAILCRM_URL || !RETAILCRM_API_KEY)) {
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

// Инструмент: получить заказ по номеру
server.tool(
  "get_order_by_number",
  {
    number: z.string().describe("Номер заказа"),
  },
  async ({ number }) => {
    const result = await client.getOrderByNumber(number);
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
    order: z.string().describe("JSON-строка с данными заказа. Пример: '{\"status\": \"new\", \"customer\": {\"id\": 123}, \"items\": [...]}'"),
  },
  async ({ order }) => {
    // Парсим JSON-строку в объект
    let orderData;
    try {
      orderData = JSON.parse(order);
    } catch (e) {
      throw new Error(`Параметр order должен быть валидной JSON-строкой. Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    if (typeof orderData !== 'object' || orderData === null) {
      throw new Error("Параметр order должен содержать объект в JSON-формате");
    }
    
    const result = await client.createOrder(orderData);
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

// Инструмент: редактировать заказ
// Примеры использования:
// 1. Смена статуса: edit_order({id: 352121, order: '{"status": "completed"}'})
// 2. Изменение адреса: edit_order({id: 352121, order: '{"delivery": {"address": {"text": "ул. Ленина, д. 10"}}}'})
// 3. Обновление клиента: edit_order({id: 352121, order: '{"customer": {"id": 12345}}'})
server.tool(
  "edit_order",
  {
    id: z.union([z.number(), z.string()]).describe("ID заказа (число) или externalId (строка)"),
    by: z.enum(["id", "externalId"]).optional().default("id").describe("Тип идентификатора: id или externalId"),
    site: z.string().optional().describe("Код магазина (обязательно при использовании externalId)"),
    order: z.string().describe("JSON-строка с данными для обновления. Примеры: '{\"status\": \"completed\"}' или '{\"customer\": {\"id\": 123}}'"),
  },
  async ({ id, by, site, order }) => {
    // Парсим JSON-строку в объект
    let orderData;
    try {
      orderData = JSON.parse(order);
    } catch (e) {
      throw new Error(`Параметр order должен быть валидной JSON-строкой. Ошибка: ${e instanceof Error ? e.message : String(e)}. Пример: '{"status": "completed"}'`);
    }
    
    if (typeof orderData !== 'object' || orderData === null) {
      throw new Error("Параметр order должен содержать объект в JSON-формате");
    }
    
    const result = await client.editOrder(id, by, site, orderData);
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

// Инструмент: получить справочники
server.tool(
  "get_order_statuses",
  {},
  async () => {
    const result = await client.getOrderStatuses();
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

server.tool(
  "get_delivery_types",
  {},
  async () => {
    const result = await client.getDeliveryTypes();
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

server.tool(
  "get_payment_types",
  {},
  async () => {
    const result = await client.getPaymentTypes();
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

server.tool(
  "get_sites",
  {},
  async () => {
    const result = await client.getSites();
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

// Инструмент: получить историю заказа
server.tool(
  "get_order_history",
  {
    id: z.number().describe("ID заказа"),
  },
  async ({ id }) => {
    const result = await client.getOrderHistory(id);
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

// Инструмент: получить файлы заказа
server.tool(
  "get_order_files",
  {
    id: z.number().describe("ID заказа"),
  },
  async ({ id }) => {
    const result = await client.getOrderFiles(id);
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

// Инструмент: получить комментарии заказа
server.tool(
  "get_order_comments",
  {
    id: z.number().describe("ID заказа"),
  },
  async ({ id }) => {
    const result = await client.getOrderComments(id);
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

// Инструмент: получить статистику заказов
server.tool(
  "get_orders_statistics",
  {
    filters: z.record(z.any()).optional().describe("Фильтры для статистики"),
  },
  async ({ filters }) => {
    const result = await client.getOrdersStatistics(filters);
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

// Инструмент: получить статистику клиентов
server.tool(
  "get_customers_statistics",
  {},
  async () => {
    const result = await client.getCustomersStatistics();
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

// Инструмент: получить список задач
server.tool(
  "get_tasks",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getTasks({ limit, page, filter });
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

// Инструмент: создать задачу
server.tool(
  "create_task",
  {
    task: z.record(z.any()).describe("Данные задачи"),
  },
  async ({ task }) => {
    const result = await client.createTask(task);
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

// ==================== РАСХОДЫ (COSTS) ====================

// Инструмент: получить список расходов
server.tool(
  "get_costs",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getCosts({ limit, page, filter });
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

// Инструмент: получить расход по ID
server.tool(
  "get_cost",
  {
    id: z.number().describe("ID расхода"),
  },
  async ({ id }) => {
    const result = await client.getCost(id);
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

// Инструмент: создать расход
server.tool(
  "create_cost",
  {
    cost: z.record(z.any()).describe("Данные расхода (name, date, summ, costItem, etc.)"),
  },
  async ({ cost }) => {
    const result = await client.createCost(cost);
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

// Инструмент: удалить расход
server.tool(
  "delete_cost",
  {
    id: z.number().describe("ID расхода для удаления"),
  },
  async ({ id }) => {
    const result = await client.deleteCost(id);
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

// ==================== ПОЛЬЗОВАТЕЛЬСКИЕ ПОЛЯ (CUSTOM FIELDS) ====================

// Инструмент: получить список пользовательских полей
server.tool(
  "get_custom_fields",
  {
    entity: z.enum(["order", "customer", "product", "user", "task"]).describe("Тип сущности"),
  },
  async ({ entity }) => {
    const result = await client.getCustomFields(entity);
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

// Инструмент: получить справочники пользовательских полей
server.tool(
  "get_custom_field_dictionaries",
  {},
  async () => {
    const result = await client.getCustomFieldDictionaries();
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

// ==================== ПОЛЬЗОВАТЕЛИ (USERS) ====================

// Инструмент: получить список пользователей
server.tool(
  "get_users",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getUsers({ limit, page, filter });
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

// Инструмент: получить пользователя по ID
server.tool(
  "get_user",
  {
    id: z.number().describe("ID пользователя"),
  },
  async ({ id }) => {
    const result = await client.getUser(id);
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

// Инструмент: изменить статус пользователя
server.tool(
  "set_user_status",
  {
    id: z.number().describe("ID пользователя"),
    status: z.enum(["active", "inactive", "sick", "vacation"]).describe("Новый статус"),
  },
  async ({ id, status }) => {
    const result = await client.setUserStatus(id, status);
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

// ==================== ФАЙЛЫ (FILES) ====================

// Инструмент: получить список файлов
server.tool(
  "get_files",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getFiles({ limit, page, filter });
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

// Инструмент: получить файл по ID
server.tool(
  "get_file",
  {
    id: z.number().describe("ID файла"),
  },
  async ({ id }) => {
    const result = await client.getFile(id);
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

// Инструмент: удалить файл
server.tool(
  "delete_file",
  {
    id: z.number().describe("ID файла для удаления"),
  },
  async ({ id }) => {
    const result = await client.deleteFile(id);
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

// ==================== ДОПОЛНИТЕЛЬНЫЕ СПРАВОЧНИКИ ====================

// Инструмент: получить список курьеров
server.tool(
  "get_couriers",
  {},
  async () => {
    const result = await client.getCouriers();
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

// Инструмент: получить список складов
server.tool(
  "get_stores",
  {},
  async () => {
    const result = await client.getStores();
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

// Инструмент: получить список валют
server.tool(
  "get_currencies",
  {},
  async () => {
    const result = await client.getCurrencies();
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

// ==================== ЛОЯЛЬНОСТЬ (LOYALTY) ====================

// Инструмент: получить список участий в программе лояльности
server.tool(
  "get_loyalty_accounts",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getLoyaltyAccounts({ limit, page, filter });
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

// Инструмент: получить информацию об участии в лояльности
server.tool(
  "get_loyalty_account",
  {
    id: z.number().describe("ID участия в программе лояльности"),
  },
  async ({ id }) => {
    const result = await client.getLoyaltyAccount(id);
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

// ==================== ИСТОРИЯ ИЗМЕНЕНИЙ ====================

// Инструмент: получить историю изменения задач
server.tool(
  "get_tasks_history",
  {
    limit: z.number().optional().default(20),
    page: z.number().optional().default(1),
    filter: z.record(z.any()).optional(),
  },
  async ({ limit, page, filter }) => {
    const result = await client.getTasksHistory({ limit, page, filter });
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

// Export function to create server (for HTTP usage)
export async function createServer() {
  return server;
}

// Запуск сервера (для stdio)
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RetailCRM MCP Server running on stdio");
}

// Run as stdio server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
