import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3002;

// Health check - самый простой
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).send('OK');
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint accessed');
  res.json({
    status: 'running',
    message: 'RetailCRM MCP Server',
    port: PORT,
    available_routes: ['/health', '/manifest', '/tools', '/debug']
  });
});

// Debug endpoint
app.all('/debug', (req, res) => {
  console.log('DEBUG HIT:', req.method, req.path);
  res.json({
    message: 'Debug endpoint works!',
    method: req.method,
    path: req.path,
    headers: req.headers
  });
});

// Manifest endpoint (полный для AI Studio)
app.get('/manifest', (req, res) => {
  console.log('MANIFEST HIT!');
  res.json({
    name: "retailcrm-mcp",
    version: "1.0.0",
    description: "RetailCRM integration for AI assistants - connects to your RetailCRM instance",
    author: "aryazansev",
    homepage: "https://github.com/aryazansev/retailcrm-mcp",
    transport: "http",
    endpoints: {
      mcp: `/mcp`,
      health: `/health`,
      manifest: `/manifest`
    },
    capabilities: {
      tools: [
        "get_orders",
        "get_order", 
        "create_order",
        "edit_order",
        "get_customers",
        "get_customer",
        "get_customer_by_external_id",
        "edit_customer_by_external_id",
        "create_customer",
        "update_customer",
        "get_products",
        "get_product",
        "get_statistics",
        "get_tasks",
        "create_task",
        "get_order_history",
        "get_reference_data"
      ]
    },
    setup: {
      required_env: ["RETAILCRM_URL", "RETAILCRM_API_KEY"],
      optional_env: ["PORT"]
    }
  });
});

// Tools endpoint
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: "get_orders",
        description: "Get list of orders with filtering options",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of orders to return" },
            page: { type: "number", description: "Page number for pagination" },
            status: { type: "string", description: "Filter by order status" }
          }
        }
      },
      {
        name: "get_order",
        description: "Get detailed information about a specific order",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Order ID" }
          },
          required: ["id"]
        }
      },
      {
        name: "create_order",
        description: "Create a new order in RetailCRM",
        inputSchema: {
          type: "object",
          properties: {
            order: { 
              type: "string", 
              description: "JSON string with order data. Example: '{\"status\": \"new\", \"customer\": {\"id\": 123}}'" 
            }
          },
          required: ["order"]
        }
      },
      {
        name: "edit_order",
        description: "Edit an existing order in RetailCRM",
        inputSchema: {
          type: "object",
          properties: {
            id: { 
              type: ["number", "string"], 
              description: "Order ID (number) or externalId (string)" 
            },
            by: { 
              type: "string", 
              enum: ["id", "externalId"],
              default: "id",
              description: "Identifier type: id or externalId" 
            },
            site: { 
              type: "string", 
              description: "Site code (required when using externalId)" 
            },
            order: { 
              type: "string", 
              description: "JSON string with order data to update. Examples: '{\"status\": \"completed\"}' or '{\"customer\": {\"id\": 123}}' or '{\"delivery\": {\"address\": {\"text\": \"Street 1\"}}}'" 
            }
          },
          required: ["id", "order"]
        }
      },
      {
        name: "get_customers",
        description: "Get list of customers",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of customers to return" },
            page: { type: "number", description: "Page number for pagination" }
          }
        }
      },
      {
        name: "get_customer_by_external_id",
        description: "Get customer by external ID",
        inputSchema: {
          type: "object",
          properties: {
            externalId: { type: "string", description: "External customer ID" },
            site: { type: "string", description: "Site code" }
          },
          required: ["externalId", "site"]
        }
      },
      {
        name: "edit_customer_by_external_id",
        description: "Edit customer by external ID",
        inputSchema: {
          type: "object",
          properties: {
            externalId: { type: "string", description: "External customer ID" },
            site: { type: "string", description: "Site code" },
            customer: { type: "string", description: "JSON string with customer data. Example: '{\"firstName\": \"Ivan\", \"email\": \"test@example.com\"}'" }
          },
          required: ["externalId", "site", "customer"]
        }
      }
    ]
  });
});

// Запуск сервера с ошибками
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🔑 Environment check:`);
  console.log(`   PORT: ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`   RETAILCRM_URL: ${process.env.RETAILCRM_URL ? '✅ Set' : '❌ Missing'}`);
});

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// app.on('error', (error) => {
//   console.error('Server Error:', error);
// });