#!/bin/bash

# RetailCRM Update All Customers Vykup Script
# Run on Render as a job or locally

set -e

RETAILCRM_URL="${RETAILCRM_URL:-https://ashrussia.retailcrm.ru}"
RETAILCRM_API_KEY="${RETAILCRM_API_KEY}"
MAX_CUSTOMERS="${MAX_CUSTOMERS:-100}"

if [ -z "$RETAILCRM_API_KEY" ]; then
    echo "Error: RETAILCRM_API_KEY is not set"
    exit 1
fi

echo "========================================="
echo "  RetailCRM Update All Customers Vykup"
echo "========================================="
echo ""
echo "URL: $RETAILCRM_URL"
echo "Max Customers: $MAX_CUSTOMERS"
echo ""

# Function to make API request
api_request() {
    local endpoint="$1"
    shift
    local params="$@"
    
    curl -s -X GET "$RETAILCRM_URL/api/v5$endpoint?apiKey=$RETAILCRM_API_KEY$params"
}

# Function to get customer by phone
get_customer_by_phone() {
    local phone="$1"
    local phone_clean=$(echo "$phone" | tr -d '[:space:]' | sed 's/^+//' | sed 's/^/7/')
    
    api_request "/customers" "&limit=1&page=1&filter[phone]=$phone_clean"
}

# Function to get orders by email
get_orders_by_email() {
    local email="$1"
    local page=1
    local limit=20
    local all_orders="["
    
    while true; do
        local result=$(api_request "/orders" "&limit=$limit&page=$page&filter[email]=$email")
        local orders_count=$(echo "$result" | grep -o '"id":' | wc -l)
        
        if [ "$orders_count" -eq 0 ]; then
            break
        fi
        
        # Remove first [ and last ] from result if not first page
        if [ "$page" -eq 1 ]; then
            all_orders="$result"
        else
            # Append orders
            local new_orders=$(echo "$result" | sed 's/^\[//' | sed 's/\]$//')
            all_orders="${all_orders%,$new_orders"
        fi
        
        if [ "$orders_count" -lt "$limit" ]; then
            break
        fi
        
        page=$((page + 1))
    done
    
    echo "$all_orders"
}

# Function to update customer vykup
update_customer_vykup() {
    local external_id="$1"
    local site="$2"
    local vykup="$3"
    
    curl -s -X POST "$RETAILCRM_URL/api/v5/customers/$external_id/edit?apiKey=$RETAILCRM_API_KEY&by=externalId&site=$site" \
        -H "Content-Type: application/json" \
        -d "{\"customer\":{\"customFields\":{\"vykup\":$vykup}}}"
}

# Get total customers count
echo "Getting customers list..."
total_result=$(api_request "/customers" "&limit=1&page=1")
total_customers=$(echo "$total_result" | grep -o '"totalCount":[0-9]*' | grep -o '[0-9]*')

if [ -z "$total_customers" ]; then
    total_customers="$MAX_CUSTOMERS"
fi

echo "Total customers in CRM: $total_customers"
echo "Will process up to: $MAX_CUSTOMERS"
echo ""
echo "Starting processing..."
echo "========================================="
echo ""

processed=0
updated=0
skipped=0
errors=0
page=1

# Process customers in batches
while [ "$processed" -lt "$MAX_CUSTOMERS" ]; do
    echo "--- Page $page ---"
    
    result=$(api_request "/customers" "&limit=20&page=$page")
    
    # Check if we have customers
    if ! echo "$result" | grep -q '"id":'; then
        echo "No more customers found."
        break
    fi
    
    # Extract customer IDs
    customer_ids=$(echo "$result" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
    
    for customer_id in $customer_ids; do
        processed=$((processed + 1))
        
        if [ "$processed" -gt "$MAX_CUSTOMERS" ]; then
            break
        fi
        
        echo -n "[$processed] Customer ID $customer_id: "
        
        # Get customer details
        customer_info=$(api_request "/customers/$customer_id")
        
        # Check if customer has externalId and site
        external_id=$(echo "$customer_info" | grep -o '"externalId":"[^"]*"' | sed 's/"externalId":"//;s/"$//' | head -1)
        site=$(echo "$customer_info" | grep -o '"site":"[^"]*"' | sed 's/"site":"//;s/"$//' | head -1)
        email=$(echo "$customer_info" | grep -o '"email":"[^"]*"' | sed 's/"email":"//;s/"$//' | head -1)
        name=$(echo "$customer_info" | grep -o '"firstName":"[^"]*"' | sed 's/"firstName":"//;s/"$//' | head -1)
        lastname=$(echo "$customer_info" | grep -o '"lastName":"[^"]*"' | sed 's/"lastName":"//;s/"$//' | head -1)
        
        if [ -z "$email" ]; then
            echo "No email, skipping"
            skipped=$((skipped + 1))
            continue
        fi
        
        if [ -z "$external_id" ] || [ -z "$site" ]; then
            echo "No externalId or site, skipping"
            skipped=$((skipped + 1))
            continue
        fi
        
        echo -n "($name $lastname) "
        
        # Get orders by email
        orders_result=$(api_request "/orders" "&limit=100&page=1&filter[email]=$email")
        
        # Count completed and canceled
        completed=$(echo "$orders_result" | grep -o '"status":"completed"' | wc -l | tr -d ' ')
        canceled=$(echo "$orders_result" | grep -o '"status":"cancel-other"' | wc -l | tr -d ' ')
        vozvrat=$(echo "$orders_result" | grep -o '"status":"vozvrat-im"' | wc -l | tr -d ' ')
        
        total_canceled=$((canceled + vozvrat))
        
        if [ "$total_canceled" -eq 0 ]; then
            if [ "$completed" -gt 0 ]; then
                vykup=100
            else
                vykup=0
            fi
        else
            vykup=$(( (completed * 100 + total_canceled - 1) / total_canceled ))  # ceil
        fi
        
        echo "Orders: completed=$completed, canceled=$total_canceled, vykup=$vykup%"
        
        # Update customer
        if [ "$vykup" -gt 0 ]; then
            update_result=$(update_customer_vykup "$external_id" "$site" "$vykup")
            
            if echo "$update_result" | grep -q '"success":true'; then
                updated=$((updated + 1))
                echo "  -> Updated!"
            else
                echo "  -> Error updating"
                errors=$((errors + 1))
            fi
        else
            skipped=$((skipped + 1))
        fi
        
        # Small delay to not overload API
        sleep 0.3
    done
    
    page=$((page + 1))
    echo ""
done

echo "========================================="
echo "  SUMMARY"
echo "========================================="
echo "Total processed: $processed"
echo "Updated: $updated"
echo "Skipped: $skipped"
echo "Errors: $errors"
echo ""
echo "Done!"
