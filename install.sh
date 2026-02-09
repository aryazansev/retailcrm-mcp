#!/bin/bash

set -e

echo "🚀 Установка RetailCRM MCP Server..."

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Пожалуйста, установите Node.js 18+"
    echo "   Скачать можно с: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Требуется Node.js 18+. У вас установлена версия $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Клонируем репозиторий или используем текущую папку
if [ -d ".git" ]; then
    echo "📦 Используем текущую папку..."
    INSTALL_DIR="$(pwd)"
else
    INSTALL_DIR="$HOME/retailcrm-mcp"
    if [ -d "$INSTALL_DIR" ]; then
        echo "📁 Папка $INSTALL_DIR уже существует. Обновляем..."
        cd "$INSTALL_DIR"
        git pull
    else
        echo "📥 Клонирование репозитория..."
        git clone https://github.com/yourusername/retailcrm-mcp.git "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
fi

# Устанавливаем зависимости
echo "📦 Установка зависимостей..."
npm install

# Собираем проект
echo "🔨 Сборка проекта..."
npm run build

# Создаем папку для конфигурации
CONFIG_DIR="$HOME/.retailcrm-mcp"
mkdir -p "$CONFIG_DIR"

# Запрашиваем данные у пользователя
echo ""
echo "⚙️  Настройка подключения к RetailCRM:"
echo ""

read -p "Введите URL RetailCRM (например: https://your-account.retailcrm.ru): " RETAILCRM_URL
read -p "Введите API ключ: " RETAILCRM_API_KEY

# Создаем .env файл
cat > "$CONFIG_DIR/.env" << EOF
RETAILCRM_URL=$RETAILCRM_URL
RETAILCRM_API_KEY=$RETAILCRM_API_KEY
EOF

echo ""
echo "✅ Конфигурация сохранена в $CONFIG_DIR/.env"

# Создаем символическую ссылку на .env в папке проекта
ln -sf "$CONFIG_DIR/.env" "$INSTALL_DIR/.env" 2>/dev/null || true

# Создаем пример конфигурации Claude Desktop
echo ""
echo "📝 Создание конфигурации Claude Desktop..."

CLAUDE_CONFIG_DIR=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    CLAUDE_CONFIG_DIR="$APPDATA/Claude"
else
    # Linux
    CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
fi

if [ -d "$CLAUDE_CONFIG_DIR" ]; then
    CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    
    # Создаем backup если файл существует
    if [ -f "$CLAUDE_CONFIG_FILE" ]; then
        cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Создаем или обновляем конфигурацию
    cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "retailcrm": {
      "command": "bash",
      "args": [
        "-c",
        "export NVM_DIR=\\"\$HOME/.nvm\\" && [ -s \\"\$NVM_DIR/nvm.sh\\" ] && . \\"\$NVM_DIR/nvm.sh\\" && export RETAILCRM_URL=\\"$RETAILCRM_URL\\" && export RETAILCRM_API_KEY=\\"$RETAILCRM_API_KEY\\" && node $INSTALL_DIR/build/index.js"
      ]
    }
  }
}
EOF
    
    echo "✅ Конфигурация Claude Desktop обновлена: $CLAUDE_CONFIG_FILE"
    echo ""
    echo "🔄 Перезапустите Claude Desktop для применения изменений"
else
    echo "⚠️  Папка конфигурации Claude Desktop не найдена"
    echo "   Создайте файл вручную:"
    echo "   $CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    echo ""
    echo "   Содержимое:"
    echo "   {"
    echo "     \"mcpServers\": {"
    echo "       \"retailcrm\": {"
    echo "         \"command\": \"node\","
    echo "         \"args\": [\"$INSTALL_DIR/build/index.js\"],"
    echo "         \"env\": {"
    echo "           \"RETAILCRM_URL\": \"$RETAILCRM_URL\","
    echo "           \"RETAILCRM_API_KEY\": \"$RETAILCRM_API_KEY\""
    echo "         }"
    echo "       }"
    echo "     }"
    echo "   }"
fi

echo ""
echo "🎉 Установка завершена!"
echo ""
echo "📖 Доступные команды:"
echo "   - npm run build    # Пересобрать проект"
echo "   - npm run watch    # Режим разработки"
echo ""
echo "💡 Теперь вы можете спрашивать Claude:"
echo "   • 'Покажи последние заказы'"
echo "   • 'Найди заказ номер 12345'"
echo "   • 'Покажи список клиентов'"
echo ""
