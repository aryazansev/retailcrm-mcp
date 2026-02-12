import express from 'express';
import cors from 'cors';
import { createServer } from './index.js';

const app = express();
const PORT = Number(process.env.PORT) || Number(process.env.MCP_PORT) || 3002;

// Health check before anything else (no dependencies)
app.get('/health', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      port: process.env.MCP_PORT || 3002
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: 'Health check failed' });
  }
});

// Enable CORS for AI Studio and other clients
app.use(cors({
  origin: [
    'https://ai.anthropic.com',
    'https://claude.ai',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Parse JSON bodies
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: "RetailCRM MCP Server",
    status: "running",
    endpoints: {
      health: "/health",
      manifest: "/manifest",
      tools: "/tools",
      mcp: "/mcp"
    }
  });
});



// MCP Server manifest endpoint for discovery
app.get('/manifest', (req, res) => {
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
        "update_order",
        "get_customers",
        "get_customer",
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
      optional_env: ["MCP_PORT"]
    }
  });
});

// Create and start MCP server
async function startServer() {
  try {
    console.log('🚀 Starting RetailCRM MCP Server...');
    console.log('📍 Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.MCP_PORT || 3002,
      RETAILCRM_URL: process.env.RETAILCRM_URL ? '✅ Set' : '❌ Missing'
    });
    
    // Create MCP server instance
    const mcpServer = await createServer();
    
    // List all available tools
    app.get('/tools', async (req, res) => {
      try {
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
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_order",
              description: "Get detailed information about a specific order",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Order ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_order_by_number",
              description: "Get order by order number",
              inputSchema: {
                type: "object",
                properties: {
                  number: { type: "string", description: "Order number" }
                },
                required: ["number"]
              }
            },
            {
              name: "create_order",
              description: "Create a new order",
              inputSchema: {
                type: "object",
                properties: {
                  order: { type: "object", description: "Order data" }
                },
                required: ["order"]
              }
            },
            {
              name: "get_customers",
              description: "Get list of customers",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of customers to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_customer",
              description: "Get customer by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Customer ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_products",
              description: "Get list of products",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of products to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_product",
              description: "Get product by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Product ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_order_statuses",
              description: "Get order statuses reference",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_delivery_types",
              description: "Get delivery types reference",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_payment_types",
              description: "Get payment types reference",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_sites",
              description: "Get sites reference",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_order_history",
              description: "Get order history by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Order ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_order_files",
              description: "Get order files by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Order ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_order_comments",
              description: "Get order comments by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Order ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_orders_statistics",
              description: "Get orders statistics",
              inputSchema: {
                type: "object",
                properties: {
                  filters: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_customers_statistics",
              description: "Get customers statistics",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_tasks",
              description: "Get list of tasks",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of tasks to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "create_task",
              description: "Create a new task",
              inputSchema: {
                type: "object",
                properties: {
                  task: { type: "object", description: "Task data" }
                },
                required: ["task"]
              }
            },
            {
              name: "get_costs",
              description: "Get list of costs",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of costs to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_cost",
              description: "Get cost by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Cost ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "create_cost",
              description: "Create a new cost",
              inputSchema: {
                type: "object",
                properties: {
                  cost: { type: "object", description: "Cost data" }
                },
                required: ["cost"]
              }
            },
            {
              name: "delete_cost",
              description: "Delete cost by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Cost ID to delete" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_custom_fields",
              description: "Get custom fields by entity type",
              inputSchema: {
                type: "object",
                properties: {
                  entity: { type: "string", enum: ["order", "customer", "product", "user", "task"], description: "Entity type" }
                },
                required: ["entity"]
              }
            },
            {
              name: "get_custom_field_dictionaries",
              description: "Get custom field dictionaries",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_users",
              description: "Get list of users",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of users to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_user",
              description: "Get user by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "User ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "set_user_status",
              description: "Set user status",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "User ID" },
                  status: { type: "string", enum: ["active", "inactive", "sick", "vacation"], description: "New status" }
                },
                required: ["id", "status"]
              }
            },
            {
              name: "get_files",
              description: "Get list of files",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of files to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_file",
              description: "Get file by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "File ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "delete_file",
              description: "Delete file by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "File ID to delete" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_couriers",
              description: "Get list of couriers",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_stores",
              description: "Get list of stores",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_currencies",
              description: "Get list of currencies",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_loyalty_accounts",
              description: "Get loyalty program accounts",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of accounts to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            },
            {
              name: "get_loyalty_account",
              description: "Get loyalty account by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Loyalty account ID" }
                },
                required: ["id"]
              }
            },
            {
              name: "get_tasks_history",
              description: "Get tasks history",
              inputSchema: {
                type: "object",
                properties: {
                  limit: { type: "number", description: "Maximum number of history records to return" },
                  page: { type: "number", description: "Page number for pagination" },
                  filter: { type: "object", description: "Filter options" }
                }
              }
            }
          ]
        });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // MCP tools endpoint (for compatibility with MCP client)
    app.get('/mcp/tools', async (req, res) => {
      try {
        // Redirect to /tools endpoint
        const toolsResponse = await fetch(`http://localhost:${PORT}/tools`);
        const data = await toolsResponse.json();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`✅ RetailCRM MCP Server running on HTTP port ${PORT}`);
      console.log(`📋 Manifest: http://localhost:${PORT}/manifest`);
      console.log(`🔧 Tools: http://localhost:${PORT}/tools`);
      console.log(`❤️  Health: http://localhost:${PORT}/health`);
      console.log(`🔗 MCP Endpoint: http://localhost:${PORT}/mcp`);
      console.log('');
      console.log('🔗 To connect with AI Studio:');
      console.log(`   Use this URL: http://localhost:${PORT}/manifest`);
      console.log('');
      console.log('🌐 Repository: https://github.com/aryazansev/retailcrm-mcp');
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

    console.log('🏥 Health check ready on /health');

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down RetailCRM MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down RetailCRM MCP Server...');
  process.exit(0);
});

// Start the server
startServer();