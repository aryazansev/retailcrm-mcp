#!/usr/bin/env node

import fetch from 'node-fetch';

const RETAILCRM_URL = process.env.RETAILCRM_URL || 'https://ashrussia.retailcrm.ru';
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || 'UaINijPrU0CMzhX8icKlsDLNC0wVGXZ5';

const MAX_CUSTOMERS = parseInt(process.env.MAX_CUSTOMERS) || 100;
const BATCH_SIZE = 10;

async function request(endpoint, params = {}) {
  const url = new URL(`${RETAILCRM_URL}/api/v5${endpoint}`);
  url.searchParams.append('apiKey', RETAILCRM_API_KEY);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  const data = await response.json();
  
  if (!response.ok || data.success === false) {
    throw new Error(`API Error: ${data.errorMsg || response.statusText}`);
  }
  
  return data;
}

async function getCustomerByPhone(phone) {
  const phoneClean = phone.replace(/\D/g, '');
  
  const url = new URL(`${RETAILCRM_URL}/api/v5/customers`);
  url.searchParams.append('apiKey', RETAILCRM_API_KEY);
  url.searchParams.append('limit', '20');
  url.searchParams.append('page', '1');
  url.searchParams.append('filter[phone]', phoneClean);
  
  const response = await fetch(url.toString());
  const data = await response.json();
  
  if (!data.customers || data.customers.length === 0) {
    return null;
  }
  
  return data.customers[0];
}

async function getOrdersByEmail(email) {
  const orders = [];
  let page = 1;
  const limit = 20;
  
  while (true) {
    const result = await request('/orders', {
      limit,
      page,
      'filter[email]': email
    });
    
    if (!result.orders || result.orders.length === 0) {
      break;
    }
    
    orders.push(...result.orders);
    
    if (result.orders.length < limit) {
      break;
    }
    page++;
  }
  
  return orders;
}

async function updateCustomerVykup(customer, vykupPercent) {
  if (!customer.externalId || !customer.site) {
    console.log(`Skipping customer ${customer.id} - no externalId or site`);
    return false;
  }
  
  const url = new URL(`${RETAILCRM_URL}/api/v5/customers/${customer.externalId}/edit`);
  url.searchParams.append('apiKey', RETAILCRM_API_KEY);
  url.searchParams.append('by', 'externalId');
  url.searchParams.append('site', customer.site);
  
  const body = JSON.stringify({
    customer: {
      customFields: {
        vykup: vykupPercent
      }
    }
  });
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body
  });
  
  const data = await response.json();
  
  if (response.ok && data.success !== false) {
    return true;
  }
  
  console.log(`Failed to update customer ${customer.id}:`, data.errorMsg);
  return false;
}

async function processAllCustomers() {
  console.log(`Starting to process up to ${MAX_CUSTOMERS} customers...\n`);
  
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let page = 1;
  
  while (processed < MAX_CUSTOMERS) {
    console.log(`Fetching customers page ${page}...`);
    
    const result = await request('/customers', {
      limit: BATCH_SIZE,
      page
    });
    
    if (!result.customers || result.customers.length === 0) {
      console.log('\nNo more customers found.');
      break;
    }
    
    for (const customer of result.customers) {
      processed++;
      
      try {
        const email = customer.email;
        
        if (!email) {
          console.log(`[${processed}] Customer ${customer.id}: No email, skipping`);
          skipped++;
          continue;
        }
        
        console.log(`[${processed}] Processing customer ${customer.id} (${customer.firstName} ${customer.lastName})...`);
        
        const orders = await getOrdersByEmail(email);
        
        if (!orders || orders.length === 0) {
          console.log(`  -> No orders, skipping`);
          skipped++;
          continue;
        }
        
        let completed = 0;
        let canceled = 0;
        
        for (const order of orders) {
          if (order.status === 'completed') {
            completed++;
          } else if (order.status === 'cancel-other' || order.status === 'vozvrat-im') {
            canceled++;
          }
        }
        
        let vykupPercent = 0;
        if (canceled > 0) {
          vykupPercent = Math.ceil((completed / canceled) * 100);
        } else if (completed > 0) {
          vykupPercent = 100;
        }
        
        console.log(`  -> Orders: ${orders.length}, Completed: ${completed}, Canceled: ${canceled}, Vykup: ${vykupPercent}%`);
        
        if (vykupPercent > 0) {
          const success = await updateCustomerVykup(customer, vykupPercent);
          if (success) {
            updated++;
            console.log(`  -> Updated!`);
          } else {
            errors++;
          }
        } else {
          skipped++;
        }
        
      } catch (err) {
        console.log(`[${processed}] Error:`, err.message);
        errors++;
      }
    }
    
    if (result.customers.length < BATCH_SIZE) {
      break;
    }
    
    page++;
    
    // Small delay to not overload API
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

processAllCustomers().catch(console.error);
