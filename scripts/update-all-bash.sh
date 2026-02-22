#!/bin/bash

# RetailCRM Update All Customers Vykup Script

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

# Function to update customer vykup by internal ID
update_customer_vykup() {
    local customer_id="$1"
    local site="$2"
    local vykup="$3"
    
    curl -s -X POST "$RETAILCRM_URL/api/v5/customers/$customer_id/edit?apiKey=$RETAILCRM_API_KEY&site=$site" \
        -H "Content-Type: application/json" \
        -d "{\"customer\":{\"customFields\":{\"vykup\":$vykup}}}"
}

# Build customer -> order counts map from orders
echo "Step 1: Building order counts from all orders..."
echo ""

# Use temp files to store counts
COMPLETED_FILE=$(mktemp)
CANCELED_FILE=$(mktemp)

# Initialize
> "$COMPLETED_FILE"
> "$CANCELED_FILE"

# Get total orders
orders_info=$(api_request "/orders" "&limit=20&page=1")
total_orders=$(echo "$orders_info" | grep -o '"totalCount":[0-9]*' | grep -o '[0-9]*')
total_pages=$(( (total_orders + 99) / 100 ))

echo "Total orders: $total_orders"
echo "Pages to process: $total_pages"
echo ""

# Process orders page by page
for page in $(seq 1 $total_pages); do
    if [ $((page % 100)) -eq 0 ]; then
        echo "Processed $page / $total_pages pages..."
    fi
    
    result=$(api_request "/orders" "&limit=100&page=$page")
    
    # Extract customer IDs and statuses
    # Format: "id":123,"status":"completed","customer":{"type":"customer","id":456
    echo "$result" | grep -o '"status":"[^"]*","customer":{"type":"customer","id":[0-9]*' | sed 's/"status":"//;s/","customer":{"type":"customer","id":/ /;s/"}//' | while read -r status cid; do
        if [ "$status" = "completed" ]; then
            echo "$cid" >> "$COMPLETED_FILE"
        elif [ "$status" = "cancel-other" ] || [ "$status" = "vozvrat-im" ]; then
            echo "$cid" >> "$CANCELED_FILE"
        fi
    done
    
    sleep 0.05
done

echo "Order counting complete!"
echo ""

# Count occurrences for each customer
echo "Step 2: Counting orders per customer..."
echo ""

# Process customers
echo "Getting customers..."
total_result=$(api_request "/customers" "&limit=20&page=1")
total_customers=$(echo "$total_result" | grep -o '"totalCount":[0-9]*' | grep -o '[0-9]*')

echo "Total customers: $total_customers"
echo "Will process: $MAX_CUSTOMERS"
echo ""
echo "Starting updates..."
echo "========================================="
echo ""

processed=0
updated=0
skipped=0
errors=0
page=1

# Process customers
while [ "$processed" -lt "$MAX_CUSTOMERS" ]; do
    result=$(api_request "/customers" "&limit=20&page=$page")
    
    if ! echo "$result" | grep -q '"id":'; then
        break
    fi
    
    # Extract customer IDs and sites
    echo "$result" | grep -o '"id":[0-9]*,"isContact":[^,]*,"createdAt":"[^"]*","vip":[^,]*,"bad":[^,]*,"site":"[^"]*"' | while read -r line; do
        processed=$((processed + 1))
        
        if [ "$processed" -gt "$MAX_CUSTOMERS" ]; then
            break
        fi
        
        customer_id=$(echo "$line" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
        site=$(echo "$line" | grep -o '"site":"[^"]*"' | sed 's/"site":"//;s/"//')
        
        if [ -z "$site" ]; then
            echo "[$processed] Customer $customer_id: No site, skipping"
            skipped=$((skipped + 1))
            return
        fi
        
        echo -n "[$processed] Customer $customer_id (site: $site): "
        
        # Count orders for this customer
        completed=$(grep -c "^$customer_id$" "$COMPLETED_FILE" 2>/dev/null || echo "0")
        canceled=$(grep -c "^$customer_id$" "$CANCELED_FILE" 2>/dev/null || echo "0")
        
        if [ "$completed" -eq 0 ] && [ "$canceled" -eq 0 ]; then
            echo "No orders, skipping"
            skipped=$((skipped + 1))
            return
        fi
        
        if [ "$canceled" -eq 0 ]; then
            if [ "$completed" -gt 0 ]; then
                vykup=100
            else
                vykup=0
            fi
        else
            vykup=$(( (completed * 100 + canceled - 1) / canceled ))
        fi
        
        echo "completed=$completed, canceled=$canceled, vykup=$vykup%"
        
        if [ "$vykup" -gt 0 ]; then
            update_result=$(update_customer_vykup "$customer_id" "$site" "$vykup")
            
            if echo "$update_result" | grep -q '"success":true'; then
                updated=$((updated + 1))
                echo "  -> Updated!"
            else
                echo "  -> Error"
                errors=$((errors + 1))
            fi
        else
            skipped=$((skipped + 1))
        fi
        
        sleep 0.2
    done
    
    page=$((page + 1))
done

# Cleanup
rm -f "$COMPLETED_FILE" "$CANCELED_FILE"

echo ""
echo "========================================="
echo "  SUMMARY"
echo "========================================="
echo "Total processed: $processed"
echo "Updated: $updated"
echo "Skipped: $skipped"
echo "Errors: $errors"
echo ""
echo "Done!"
