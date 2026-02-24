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

// Webhook для расчета процента выкупа
app.all('/webhook/vykup', async (req, res) => {
  try {
    console.log('Webhook received.');
    console.log('Body (raw):', JSON.stringify(req.body));
    
    // Support multiple formats
    const body = req.body || {};
    const query = req.query || {};
    
    // Try to get orderId, customerId or phone
    const orderId = body.orderId || body.order_id || query.orderId || query.order_id;
    const bodyPhone = body.phone || query.phone;
    const bodyCustomerId = body.customerId || body.customer_id || query.customerId || query.customer_id;
    const queryPhone = query.phone as string;
    const queryCustomerId = query.customerId as string;
    
    const phone = bodyPhone || queryPhone;
    let customerId = bodyCustomerId || queryCustomerId ? Number(bodyCustomerId || queryCustomerId) : null;
    const orderIdNum = orderId ? Number(orderId) : null;
    
    console.log('Parsed: phone=', phone, 'customerId=', customerId, 'orderId=', orderIdNum);
    
    let normalizedPhone = null;
    try {
      if (phone && typeof phone === 'string') {
        normalizedPhone = phone.replace(/\D/g, '');
        if (!normalizedPhone.startsWith('7')) {
          normalizedPhone = '7' + normalizedPhone;
        }
      }
    } catch (e) {
      console.log('Error normalizing phone:', e);
      normalizedPhone = null;
    }
    
    if (!normalizedPhone && !customerId && !orderIdNum) {
      return res.status(400).json({ error: 'Требуется phone, customerId или orderId' });
    }
    
    const { RetailCRMClient } = await import('./client.js');
    const RETAILCRM_URL = process.env.RETAILCRM_URL || '';
    const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || '';
    
    if (!RETAILCRM_URL || !RETAILCRM_API_KEY) {
      return res.status(500).json({ error: 'RETAILCRM_URL or RETAILCRM_API_KEY not configured' });
    }
    
    const client = new RetailCRMClient(RETAILCRM_URL, RETAILCRM_API_KEY);
    
    console.log('Looking for customer. Phone:', normalizedPhone, 'CustomerId:', customerId, 'OrderId:', orderIdNum);
    
    let customer;
    let customerSite = null;
    
    // Skip orderId lookup - webhook always sends customerId
    
    try {
      if (customerId) {
        console.log('Getting customer by ID:', customerId);
        
        // Use filter by id - much faster
        const sitesToTry = ['ashrussia-ru', 'justcouture-ru', 'unitednude-ru', 'afiapark', 'atrium', 'afimol', 'vnukovo', 'tsvetnoi', 'metropolis', 'novaia-riga', 'paveletskaia-plaza'];
        
        for (const s of sitesToTry) {
          try {
            const customersResult = await client.getCustomers({
              limit: 1,
              page: 1,
              filter: { id: customerId }
            });
            
            if (customersResult.customers && customersResult.customers.length > 0) {
              customer = customersResult.customers[0];
              customerSite = s;
              console.log('Found customer with site:', s);
              break;
            }
          } catch (e) {
            console.log('Site', s, 'failed:', e);
          }
        }
                break;
              }
            } catch (e) {
              console.log('Site', s, 'failed:', e);
            }
          }
        }
      } else {
        console.log('Getting customer by phone:', normalizedPhone);
        const customerResult = await client.getCustomerByPhone(normalizedPhone || '');
        customer = customerResult.customer;
        customerSite = customerResult.site;
        const customerExternalId = customerResult.externalId;
        console.log('Customer externalId from search:', customerExternalId);
      }
    } catch (err) {
      console.log('Error finding customer:', err);
      return res.status(404).json({ error: 'Клиент не найден: ' + err });
    }
    
    if (!customer) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    
    const customerIdCRM = customer.id;
    customerSite = customerSite || customer.site;
    console.log('Final customerSite:', customerSite);
    const customerEmail = customer.email;
    console.log('Found customer:', customerIdCRM, 'site:', customerSite, 'email:', customerEmail);
    
    let page = 1;
    let completedOrders = 0;
    let canceledOrders = 0;
    let vozvratOrders = 0;
    
    // Get all orders using filter[customerId]
    let totalOrdersFound = 0;
    const limit = 100;
    
    console.log('Fetching orders with customerId:', customerIdCRM);
    
    while (true) {
      console.log('Fetching page', page);
      const ordersResult = await client.getOrders({
        limit,
        page,
        filter: {
          customerId: customerIdCRM
        }
      });
      
      console.log('Got', ordersResult.orders?.length || 0, 'orders');
      
      if (!ordersResult.orders || ordersResult.orders.length === 0) {
        break;
      }
      
      for (const order of ordersResult.orders) {
        totalOrdersFound++;
        if (order.status === 'completed') {
          completedOrders++;
        } else if (order.status === 'cancel-other') {
          canceledOrders++;
        } else if (order.status === 'vozvrat-im') {
          vozvratOrders++;
        }
      }
      
      console.log('Page', page, '- found:', ordersResult.orders.length, 'orders');
      
      if (ordersResult.orders.length < limit) {
        break;
      }
      page++;
    }
    
    console.log('Completed:', completedOrders, 'Canceled:', canceledOrders, 'Vozvrat:', vozvratOrders, 'Total:', totalOrdersFound);
    
    // Formula: vykup = ((completed - vozvrat) / (completed + cancel-other + vozvrat)) × 100
    const totalRelevant = completedOrders + canceledOrders + vozvratOrders;
    let purchasedOrders = completedOrders - vozvratOrders;
    if (purchasedOrders < 0) purchasedOrders = 0;
    
    let vykupPercent = 0;
    if (totalRelevant > 0) {
      vykupPercent = Math.ceil((purchasedOrders / totalRelevant) * 100);
      if (vykupPercent > 100) vykupPercent = 100;
    }
    
    console.log('Vykup percent:', vykupPercent);
    console.log('Customer site:', customerSite);
    console.log('Customer externalId:', customer?.externalId);
    
    let updateResult = null;
    let updateError = null;
    let editLog = [];
    
    // Edit by internal ID - RetailCRM API supports this
    console.log('Trying edit by internal ID:', customerIdCRM, 'site:', customerSite);
    try {
      updateResult = await client.editCustomer(customerIdCRM, {
        customFields: {
          vykup: vykupPercent
        }
      }, customerSite);
      console.log('Edit by internal ID success');
    } catch (e) {
      console.log('Failed edit by internal ID:', e);
      updateError = e instanceof Error ? e.message : 'Update failed';
    }
    
    res.json({
      success: true,
      customerId: customerIdCRM,
      site: customerSite,
      phone: customer?.phones?.[0]?.number || phone,
      completedOrders,
      canceledOrders,
      vykupPercent,
      updated: updateResult?.success || false,
      updateError
    });
    
  } catch (error) {
    console.error('Webhook vykup error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Webhook для обновления всех клиентов (массовый пересчет)
app.post('/webhook/vykup/update-all', async (req, res) => {
  try {
    const { RetailCRMClient } = await import('./client.js');
    const RETAILCRM_URL = process.env.RETAILCRM_URL || '';
    const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || '';
    
    if (!RETAILCRM_URL || !RETAILCRM_API_KEY) {
      return res.status(500).json({ error: 'RETAILCRM_URL or RETAILCRM_API_KEY not configured' });
    }
    
    const client = new RetailCRMClient(RETAILCRM_URL, RETAILCRM_API_KEY);
    
    let page = 1;
    let updated = 0;
    let errors = 0;
    const limit = 50;
    const maxCustomers = parseInt(req.body.maxCustomers) || 100;
    
    while (updated < maxCustomers) {
      const customersResult = await client.getCustomers({
        limit,
        page
      });
      
      if (!customersResult.customers || customersResult.customers.length === 0) {
        break;
      }
      
      for (const customer of customersResult.customers) {
        try {
          const customerId = customer.id;
          
          let orderPage = 1;
          let completedOrders = 0;
          let canceledOrders = 0;
          const orderLimit = 100;
          
          while (true) {
            const ordersResult = await client.getOrders({
              limit: orderLimit,
              page: orderPage,
              filter: {
                customerId: customerId
              }
            });
            
            if (!ordersResult.orders || ordersResult.orders.length === 0) {
              break;
            }
            
              for (const order of ordersResult.orders) {
                if (order.status === 'completed') {
                  completedOrders++;
                } else if (order.status === 'cancel-other' || order.status === 'vozvrat-im') {
                  canceledOrders++;
                }
              }
            
            if (ordersResult.orders.length < orderLimit) {
              break;
            }
            orderPage++;
          }
          
          let vykupPercent = 0;
          if (canceledOrders > 0) {
            vykupPercent = Math.round((completedOrders / canceledOrders) * 100);
          } else if (completedOrders > 0) {
            vykupPercent = 100;
          }
          
          const custSite = customer.site;
          await client.editCustomer(customerId, {
            vykup: vykupPercent
          }, custSite);
          
          updated++;
          console.log(`Updated customer ${customerId}: completed=${completedOrders}, canceled=${canceledOrders}, vykup=${vykupPercent}%`);
          
        } catch (err) {
          errors++;
          console.error(`Error updating customer ${customer.id}:`, err);
        }
      }
      
      if (customersResult.customers.length < limit) {
        break;
      }
      page++;
    }
    
    res.json({
      success: true,
      updated,
      errors
    });
    
  } catch (error) {
    console.error('Webhook vykup update-all error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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

// Parse query strings
app.use(express.urlencoded({ extended: true }));

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
        // Forward request to /tools endpoint internally
        const toolsData = {
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
        };
        res.json(toolsData);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Tool execution endpoint for MCP compatibility
    app.post('/mcp/tools/:toolName', async (req, res) => {
      try {
        const { toolName } = req.params;
        const args = req.body.arguments || req.body;
        
        // Import client
        const { RetailCRMClient } = await import('./client.js');
        const RETAILCRM_URL = process.env.RETAILCRM_URL || '';
        const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || '';
        const client = new RetailCRMClient(RETAILCRM_URL, RETAILCRM_API_KEY);
        
        let result;
        
        switch (toolName) {
          case 'get_orders':
            result = await client.getOrders(args);
            break;
          case 'get_order':
            result = await client.getOrder(args.id);
            break;
          case 'get_order_by_number':
            result = await client.getOrderByNumber(args.number);
            break;
          case 'create_order':
            result = await client.createOrder(args.order);
            break;
          case 'edit_order':
            result = await client.editOrder(args.id, args.order);
            break;
          case 'get_customers':
            result = await client.getCustomers(args);
            break;
          case 'get_customer':
            result = await client.getCustomer(args.id);
            break;
          case 'create_customer':
            result = await client.createCustomer(args.customer);
            break;
          case 'get_products':
            result = await client.getProducts(args);
            break;
          case 'get_product':
            result = await client.getProduct(args.id);
            break;
          case 'get_order_statuses':
            result = await client.getOrderStatuses();
            break;
          case 'get_payment_types':
            result = await client.getPaymentTypes();
            break;
          case 'get_delivery_types':
            result = await client.getDeliveryTypes();
            break;
          case 'get_sites':
            result = await client.getSites();
            break;
          case 'get_order_history':
            result = await client.getOrderHistory(args.id);
            break;
          case 'get_order_files':
            result = await client.getOrderFiles(args.id);
            break;
          case 'get_order_comments':
            result = await client.getOrderComments(args.id);
            break;
          case 'get_orders_statistics':
            result = await client.getOrdersStatistics(args.filters);
            break;
          case 'get_customers_statistics':
            result = await client.getCustomersStatistics();
            break;
          case 'get_tasks':
            result = await client.getTasks(args);
            break;
          case 'create_task':
            result = await client.createTask(args.task);
            break;
          case 'get_tasks_history':
            result = await client.getTasksHistory(args);
            break;
          case 'get_costs':
            result = await client.getCosts(args);
            break;
          case 'get_cost':
            result = await client.getCost(args.id);
            break;
          case 'create_cost':
            result = await client.createCost(args.cost);
            break;
          case 'delete_cost':
            result = await client.deleteCost(args.id);
            break;
          case 'get_custom_fields':
            result = await client.getCustomFields(args.entity);
            break;
          case 'get_custom_field_dictionaries':
            result = await client.getCustomFieldDictionaries();
            break;
          case 'get_users':
            result = await client.getUsers(args);
            break;
          case 'get_user':
            result = await client.getUser(args.id);
            break;
          case 'set_user_status':
            result = await client.setUserStatus(args.id, args.status);
            break;
          case 'get_files':
            result = await client.getFiles(args);
            break;
          case 'get_file':
            result = await client.getFile(args.id);
            break;
          case 'delete_file':
            result = await client.deleteFile(args.id);
            break;
          case 'get_couriers':
            result = await client.getCouriers();
            break;
          case 'get_stores':
            result = await client.getStores();
            break;
          case 'get_currencies':
            result = await client.getCurrencies();
            break;
          case 'get_loyalty_accounts':
            result = await client.getLoyaltyAccounts(args);
            break;
          case 'get_loyalty_account':
            result = await client.getLoyaltyAccount(args.id);
            break;
          default:
            return res.status(404).json({ error: `Tool ${toolName} not found` });
        }
        
        // Return in MCP format
        res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        });
      } catch (error) {
        res.status(500).json({
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        });
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