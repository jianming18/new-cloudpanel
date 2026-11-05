#!/bin/bash
set -e

VERSION=$(cat /etc/cloudpanel-version 2>/dev/null || echo "unknown")
echo "CloudPanel v${VERSION} starting..."

mkdir -p data logs

SQLITE_PATH=${SQLITE_PATH:-/home/python/panel/db.sqlite3}
SQLITE_DIR=$(dirname "$SQLITE_PATH")
mkdir -p "$SQLITE_DIR"

if [ -d "$SQLITE_PATH" ]; then
  if [ -z "$(ls -A "$SQLITE_PATH" 2>/dev/null)" ]; then
    echo "Fixing empty SQLite directory at $SQLITE_PATH"
    rmdir "$SQLITE_PATH"
  else
    echo "ERROR: $SQLITE_PATH is a non-empty directory, not a SQLite database file."
    exit 1
  fi
fi

if [ -e "$SQLITE_PATH" ] && [ ! -f "$SQLITE_PATH" ]; then
  echo "ERROR: $SQLITE_PATH exists but is not a regular file."
  exit 1
fi

touch "$SQLITE_PATH"

# 等待 Redis 就绪
echo "Waiting for Redis..."
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}
while ! nc -z "$REDIS_HOST" "$REDIS_PORT"; do
  sleep 1
done
echo "Redis is ready!"

# 执行数据库迁移
python manage.py collectstatic --noinput
python manage.py migrate

# 初始化默认管理员 (admin/admin123), 已存在时自动跳过
python manage.py init_user

# 启动 supervisor
/usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
