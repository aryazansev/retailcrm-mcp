# RetailCRM MCP Server

MCP (Model Context Protocol) сервер для интеграции с RetailCRM API. Позволяет Claude и другим AI-ассистентам получать доступ к заказам, клиентам и товарам из вашей CRM-системы.

## 🚀 Быстрый старт

### Установка через npm

```bash
npm install -g retailcrm-mcp
```

### Или локальная установка

```bash
git clone https://github.com/yourusername/retailcrm-mcp.git
cd retailcrm-mcp
npm install
npm run build
```

## ⚙️ Настройка

### 1. Получите API ключ из RetailCRM

1. Войдите в свою панель RetailCRM
2. Перейдите в **Настройки** → **Интеграция** → **Ключи доступа к API**
3. Создайте новый ключ с правами на чтение заказов, клиентов и товаров
4. Скопируйте ключ

### 2. Создайте файл конфигурации

Создайте файл `~/.retailcrm-mcp/.env`:

```bash
mkdir -p ~/.retailcrm-mcp
cat > ~/.retailcrm-mcp/.env << 'EOF'
RETAILCRM_URL=https://your-account.retailcrm.ru
RETAILCRM_API_KEY=your_api_key_here
EOF
```

Или просто создайте `.env` файл в папке проекта:

```env
RETAILCRM_URL=https://your-account.retailcrm.ru
RETAILCRM_API_KEY=your_api_key_here
```

### 3. Настройка Claude Desktop

Откройте файл конфигурации Claude Desktop:

**macOS:**
```bash
~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%/Claude/claude_desktop_config.json
```

Добавьте:

```json
{
  "mcpServers": {
    "retailcrm": {
      "command": "retailcrm-mcp"
    }
  }
}
```

Или если установлен локально:

```json
{
  "mcpServers": {
    "retailcrm": {
      "command": "bash",
      "args": ["-c", "export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\" && export RETAILCRM_URL=\"https://your-account.retailcrm.ru\" && export RETAILCRM_API_KEY=\"your_api_key\" && node /path/to/retailcrm-mcp/build/index.js"]
    }
  }
}
```

### 4. Перезапустите Claude Desktop

Полностью закройте и откройте заново Claude Desktop.

## 💬 Использование

Теперь вы можете спрашивать Claude о данных из RetailCRM:

- *"Покажи последние 10 заказов"*
- *"Найди заказ номер 12345"*
- *"Покажи информацию о клиенте с email@example.com"*
- *"Сколько заказов у нас всего?"*
- *"Покажи товары из категории X"*

## 🛠️ Доступные инструменты

### Заказы
- `get_orders` - Получить список заказов (с фильтрацией и пагинацией)
- `get_order` - Получить информацию о конкретном заказе по ID
- `create_order` - Создать новый заказ

### Клиенты
- `get_customers` - Получить список клиентов
- `get_customer` - Получить информацию о клиенте по ID

### Товары
- `get_products` - Получить список товаров
- `get_product` - Получить информацию о товаре по ID

## 🔧 Разработка

### Сборка проекта

```bash
npm run build
```

### Запуск в режиме разработки

```bash
npm run dev
```

### Тестирование через MCP Inspector

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

## 📝 Требования

- Node.js 18+
- API ключ от RetailCRM
- Claude Desktop (для интеграции с Claude)

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🤝 Поддержка

Если у вас возникли проблемы:

1. Проверьте, что API ключ активен и имеет нужные права
2. Убедитесь, что URL RetailCRM указан правильно (без слэша в конце)
3. Проверьте логи Claude Desktop
4. Создайте issue на GitHub

## 🔗 Ссылки

- [RetailCRM API Documentation](https://docs.retailcrm.ru/Developers/API/APIMethods)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/download)
