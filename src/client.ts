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
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    console.log(`API Request: ${method} ${url.toString()}`);

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
    // Build URL manually to handle filter keys correctly
    const urlStr = `${this.baseUrl}/api/v5/orders?apiKey=${this.apiKey}`;
    const url = new URL(urlStr);
    
    // Add pagination params
    const validLimit = [20, 50, 100].includes(options.limit || 20) ? options.limit || 20 : 20;
    url.searchParams.append('limit', String(validLimit));
    url.searchParams.append('page', String(options.page || 1));
    
    // Add filter params - handle brackets correctly
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        url.searchParams.append(`filter[${key}]`, String(value));
      });
    }

    console.log('API Request:', url.toString());
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.errorMsg || response.statusText}`);
    }
    
    if (data.success === false) {
      throw new Error(`API Error: ${data.errorMsg || 'Unknown error'}`);
    }
    
    return data;
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
    const formData = new URLSearchParams();
    formData.append("order", JSON.stringify(order));
    
    const url = new URL(`${this.baseUrl}/api/v5/orders/create`);
    url.searchParams.append("apiKey", this.apiKey);
    
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.errorMsg || response.statusText}`);
    }
    
    if (data.success === false) {
      throw new Error(`API Error: ${data.errorMsg || "Unknown error"}`);
    }
    
    return data;
  }

  async editOrder(
    id: number | string,
    by: string = "id",
    site?: string,
    order?: Record<string, any>
  ): Promise<any> {
    const params: Record<string, any> = { by };
    if (site) {
      params.site = site;
    }
    
    // Формируем тело запроса в формате form-urlencoded
    const formData = new URLSearchParams();
    if (order) {
      // Сериализуем order в JSON строку
      formData.append("order", JSON.stringify(order));
    }
    
    const url = new URL(`${this.baseUrl}/api/v5/orders/${id}/edit`);
    url.searchParams.append("apiKey", this.apiKey);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.errorMsg || response.statusText}`);
    }
    
    if (data.success === false) {
      throw new Error(`API Error: ${data.errorMsg || "Unknown error"}`);
    }
    
    return data;
  }
  
  // Вспомогательный метод для преобразования объекта в плоский формат
  private flattenObject(obj: any, prefix: string, formData: URLSearchParams): void {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj !== "object") {
      formData.append(prefix, String(obj));
      return;
    }
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.flattenObject(item, `${prefix}[${index}]`, formData);
      });
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        const newKey = prefix ? `${prefix}[${key}]` : key;
        this.flattenObject(value, newKey, formData);
      });
    }
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

  async getCustomer(id: number, site?: string): Promise<any> {
    const sites = site ? [site] : ['ashrussia-ru', 'justcouture-ru', 'unitednude-ru', 'afiapark', 'atrium', 'afimol', 'vnukovo', 'tsvetnoi', 'metropolis', 'novaia-riga', 'paveletskaia-plaza'];
    
    for (const s of sites) {
      try {
        const result = await this.request("GET", `/customers/${id}`, { site: s });
        if (result.customer) {
          console.log('getCustomer result:', JSON.stringify(result));
          return { customer: result.customer, site: s };
        }
      } catch (e) {
        console.log('Site', s, 'failed:', e);
      }
    }
    
    throw new Error('Customer not found with any site');
  }

  async getCustomerByIdRaw(id: number): Promise<any> {
    // Try without site first
    try {
      const url = `${this.baseUrl}/api/v5/customers/${id}?apiKey=${this.apiKey}`;
      console.log('getCustomerByIdRaw URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('getCustomerByIdRaw response:', JSON.stringify(data));
      
      // Also try with site
      const sites = ['ashrussia-ru', 'justcouture-ru', 'unitednude-ru'];
      for (const site of sites) {
        try {
          const url2 = `${this.baseUrl}/api/v5/customers/${id}?apiKey=${this.apiKey}&site=${site}`;
          console.log('getCustomerByIdRaw trying site:', url2);
          const response2 = await fetch(url2);
          const data2 = await response2.json();
          console.log('getCustomerByIdRaw site response:', site, JSON.stringify(data2));
          if (data2.customer) {
            return data2;
          }
        } catch (e) {
          console.log('Site', site, 'error:', e);
        }
      }
      
      return data;
    } catch (e) {
      console.log('getCustomerByIdRaw error:', e);
      return null;
    }
  }

  async createCustomer(customer: Record<string, any>): Promise<any> {
    return this.request("POST", "/customers/create", undefined, { customer });
  }

  async getCustomerByExternalId(externalId: string, site: string): Promise<any> {
    return this.request("GET", `/customers/${externalId}`, { by: "externalId", site });
  }

  async getCustomerByPhone(phone: string): Promise<any> {
    const phoneClean = phone.replace(/\D/g, '');
    
    const url = new URL(`${this.baseUrl}/api/v5/customers`);
    url.searchParams.append("apiKey", this.apiKey);
    url.searchParams.append("limit", "50");
    url.searchParams.append("page", "1");
    url.searchParams.append("filter[phone]", phoneClean);
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.errorMsg || response.statusText}`);
    }
    
    if (!data.customers || data.customers.length === 0) {
      throw new Error("Customer not found");
    }
    
    const customer = data.customers[0];
    console.log('Found customer:', JSON.stringify(customer));
    return { customer, site: customer.site, externalId: customer.externalId };
  }

  async editCustomer(id: number, customer: Record<string, any>, site?: string): Promise<any> {
    console.log('editCustomer called. id:', id, 'site:', site);
    
    // Always use site if we have it
    const sitesToTry = site ? [site] : ['ashrussia-ru', 'justcouture-ru', 'unitednude-ru', 'afiapark', 'atrium', 'afimol', 'vnukovo', 'tsvetnoi', 'metropolis', 'novaia-riga', 'paveletskaia-plaza'];
    
    for (const s of sitesToTry) {
      try {
        const vykupValue = (customer as any).vykup;
        
        // Format: customFields with JSON (exact format that works)
        const customerData: any = {
          customFields: {
            vykup: vykupValue
          }
        };
        
        const url = `${this.baseUrl}/api/v5/customers/${id}/edit?apiKey=${this.apiKey}&site=${s}`;
        
        console.log('editCustomer POST to:', url);
        console.log('editCustomer body:', JSON.stringify({ customer: customerData }));
        
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer: customerData }),
        });
        
        const data = await response.json();
        console.log('editCustomer response status:', response.status);
        console.log('editCustomer response:', JSON.stringify(data));
        
        if (response.ok && data.success !== false) {
          console.log('SUCCESS! Customer updated');
          return data;
        }
        
        console.log('Site', s, 'failed:', data.errorMsg);
      } catch (e) {
        console.log('Site', s, 'error:', e);
      }
    }
    
    throw new Error('Failed to edit customer with all sites');
  }

  async editCustomerByExternalId(externalId: string, site: string, customer: Record<string, any>): Promise<any> {
    console.log('editCustomerByExternalId called. externalId:', externalId, 'site:', site);
    
    const formData = new URLSearchParams();
    formData.append("customer", JSON.stringify(customer));
    
    const url = `${this.baseUrl}/api/v5/customers/${externalId}/edit?apiKey=${this.apiKey}&by=externalId&site=${site}`;
    
    console.log('editCustomerByExternalId URL:', url);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    
    const data = await response.json();
    console.log('editCustomerByExternalId response:', JSON.stringify(data));
    
    if (!response.ok || data.success === false) {
      throw new Error(`API Error: ${data.errorMsg || response.statusText}`);
    }
    
    return data;
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
