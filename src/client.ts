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
    return this.request("GET", `/orders/${id}`);
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
}
