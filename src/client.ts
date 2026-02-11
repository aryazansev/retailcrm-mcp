export class RetailCRMClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request(
    method: string,
    endpoint: string,
    params?: Record<string, any>,
    body?: any
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}/api/v5${endpoint}`);
    url.searchParams.append("apiKey", this.apiKey);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${data.errorMsg || response.statusText}`);
    }

    if (data.success === false) {
      throw new Error(`API Error: ${data.errorMsg || "Unknown error"}`);
    }

    return data;
  }

  // Заказы
  async getOrders(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: [20, 50, 100].includes(options.limit || 20) ? options.limit || 20 : 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/orders", params);
  }

  async getOrder(id: number): Promise<any> {
    // Получаем заказ из списка с фильтром по номеру
    // Сначала получаем список, ищем заказ с нужным ID
    const result = await this.request("GET", "/orders", {
      limit: 100,
      page: 1,
    });
    const order = result.orders?.find((o: any) => o.id === id);
    if (!order) {
      throw new Error("Order not found");
    }
    return { order };
  }

  async getOrderByNumber(number: string): Promise<any> {
    const result = await this.request("GET", "/orders", {
      limit: 20,
      page: 1,
      "filter[number]": number,
    });
    if (!result.orders || result.orders.length === 0) {
      throw new Error("Order not found");
    }
    return { order: result.orders[0] };
  }

  async createOrder(order: Record<string, any>): Promise<any> {
    return this.request("POST", "/orders/create", undefined, { order });
  }

  async editOrder(id: number, order: Record<string, any>): Promise<any> {
    return this.request("POST", `/orders/${id}/edit`, undefined, { order });
  }

  // Клиенты
  async getCustomers(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/customers", params);
  }

  async getCustomer(id: number): Promise<any> {
    return this.request("GET", `/customers/${id}`);
  }

  async createCustomer(customer: Record<string, any>): Promise<any> {
    return this.request("POST", "/customers/create", undefined, { customer });
  }

  // Товары
  async getProducts(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/store/products", params);
  }

  async getProduct(id: number): Promise<any> {
    return this.request("GET", `/store/products/${id}`);
  }

  // Справочники
  async getOrderStatuses(): Promise<any> {
    return this.request("GET", "/reference/statuses");
  }

  async getPaymentTypes(): Promise<any> {
    return this.request("GET", "/reference/payment-types");
  }

  async getDeliveryTypes(): Promise<any> {
    return this.request("GET", "/reference/delivery-types");
  }

  async getSites(): Promise<any> {
    return this.request("GET", "/reference/sites");
  }

  // Дополнительные данные заказа
  async getOrderHistory(id: number): Promise<any> {
    return this.request("GET", `/orders/${id}/changes`);
  }

  async getOrderFiles(id: number): Promise<any> {
    return this.request("GET", `/orders/${id}/files`);
  }

  async getOrderComments(id: number): Promise<any> {
    return this.request("GET", `/orders/${id}/notes`);
  }

  // Статистика и отчеты
  async getOrdersStatistics(filters?: Record<string, any>): Promise<any> {
    const params: Record<string, any> = {};
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        params[key] = value;
      });
    }
    return this.request("GET", "/statistic/orders", params);
  }

  async getCustomersStatistics(): Promise<any> {
    return this.request("GET", "/statistic/customers");
  }

  // Задачи
  async getTasks(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/tasks", params);
  }

  async createTask(task: Record<string, any>): Promise<any> {
    return this.request("POST", "/tasks/create", undefined, { task });
  }

  async getTasksHistory(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/tasks/history", params);
  }

  // ==================== РАСХОДЫ (COSTS) ====================

  async getCosts(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/costs", params);
  }

  async getCost(id: number): Promise<any> {
    return this.request("GET", `/costs/${id}`);
  }

  async createCost(cost: Record<string, any>): Promise<any> {
    return this.request("POST", "/costs/create", undefined, { cost });
  }

  async deleteCost(id: number): Promise<any> {
    return this.request("POST", `/costs/${id}/delete`);
  }

  // ==================== ПОЛЬЗОВАТЕЛЬСКИЕ ПОЛЯ (CUSTOM FIELDS) ====================

  async getCustomFields(entity: string): Promise<any> {
    return this.request("GET", "/custom-fields", { entity });
  }

  async getCustomFieldDictionaries(): Promise<any> {
    return this.request("GET", "/custom-fields/dictionaries");
  }

  // ==================== ПОЛЬЗОВАТЕЛИ (USERS) ====================

  async getUsers(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/users", params);
  }

  async getUser(id: number): Promise<any> {
    return this.request("GET", `/users/${id}`);
  }

  async setUserStatus(id: number, status: string): Promise<any> {
    return this.request("POST", `/users/${id}/status`, undefined, { status });
  }

  // ==================== ФАЙЛЫ (FILES) ====================

  async getFiles(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/files", params);
  }

  async getFile(id: number): Promise<any> {
    return this.request("GET", `/files/${id}`);
  }

  async deleteFile(id: number): Promise<any> {
    return this.request("POST", `/files/${id}/delete`);
  }

  // ==================== ДОПОЛНИТЕЛЬНЫЕ СПРАВОЧНИКИ ====================

  async getCouriers(): Promise<any> {
    return this.request("GET", "/reference/couriers");
  }

  async getStores(): Promise<any> {
    return this.request("GET", "/reference/stores");
  }

  async getCurrencies(): Promise<any> {
    return this.request("GET", "/reference/currencies");
  }

  // ==================== ЛОЯЛЬНОСТЬ (LOYALTY) ====================

  async getLoyaltyAccounts(options: {
    limit?: number;
    page?: number;
    filter?: Record<string, any>;
  } = {}): Promise<any> {
    const params: Record<string, any> = {
      limit: options.limit || 20,
      page: options.page || 1,
    };

    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params[`filter[${key}]`] = value;
      });
    }

    return this.request("GET", "/loyalty/accounts", params);
  }

  async getLoyaltyAccount(id: number): Promise<any> {
    return this.request("GET", `/loyalty/accounts/${id}`);
  }
}
