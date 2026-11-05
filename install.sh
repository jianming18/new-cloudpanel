#!/bin/bash
#
# CloudPanel 一键安装脚本
# 支持: Ubuntu/Debian/CentOS/RHEL
# 功能: 自动安装 Docker、Docker Compose、部署 CloudPanel、自动初始化

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
INSTALL_DIR="/opt/cloudpanel"
SERVICE_CONTAINER="cloudpanel-api"
COMPOSE_SVC="api"

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查 root 权限
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    log_info "检测到操作系统: $OS $VERSION"
}

# 安装 Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker 已安装: $(docker --version)"
        return
    fi

    log_step "安装 Docker..."

    case $OS in
        ubuntu|debian)
            apt update -y
            apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
            curl -fsSL https://get.docker.com | bash -s docker
            ;;
        centos|rhel|rocky|almalinux)
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io
            systemctl start docker
            systemctl enable docker
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac

    docker --version
    log_info "Docker 安装完成"
}

# 安装 Docker Compose
install_compose() {
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
        log_info "Docker Compose 已安装"
        COMPOSE_CMD="$(command -v docker-compose || echo 'docker compose')"
        return
    fi

    log_step "安装 Docker Compose..."

    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
    curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    COMPOSE_CMD="docker-compose"
    log_info "Docker Compose 安装完成"
}

# 获取最新版本号
get_latest_tag() {
    local tag=$(curl -sf https://api.github.com/repos/jianming18/new-cloudpanel/tags | grep -o '"name":[[:space:]]*"v[^"]*"' | head -1 | grep -o 'v[0-9.]*' || echo "")
    if [ -n "$tag" ]; then
        echo "${tag#v}"
    else
        echo "latest"
    fi
}

# 卸载功能
do_uninstall() {
    echo ""
    echo -e "${RED}======================================${NC}"
    echo -e "${RED}  CloudPanel 卸载确认${NC}"
    echo -e "${RED}======================================${NC}"
    echo -e "您即将卸载位于 ${INSTALL_DIR} 的 CloudPanel"
    echo -e "此操作将删除所有容器、数据卷和配置文件"
    echo ""
    read -p "是否继续? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "卸载已取消"
        exit 0
    fi

    log_step "正在停止和清理 compose 容器..."
    if [ -d "$INSTALL_DIR" ]; then
        cd "$INSTALL_DIR"
        docker compose down -v
    fi

    log_step "正在清理残留容器..."
    docker rm -f cloudpanel-api cloudpanel-web cloudpanel-web2 cloudpanel-web3 panel_redis panel_mysql cloudpanel-nginx 2>/dev/null || true

    log_step "正在删除安装目录..."
    rm -rf "$INSTALL_DIR"
    
    # 清理 Docker 镜像
    log_info "清理 Docker 镜像..."
    docker rmi ghcr.io/jianming18/new-cloudpanel:latest 2>/dev/null || true
    docker image prune -f

    echo ""
    echo -e "${GREEN}CloudPanel 已成功卸载并清理!${NC}"
    exit 0
}

# 升级功能
do_update() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  CloudPanel 升级更新${NC}"
    echo -e "${BLUE}======================================${NC}"

    if [ ! -d "$INSTALL_DIR" ]; then
        log_error "未找到安装目录 ${INSTALL_DIR}，请先执行安装"
        exit 1
    fi

    cd "$INSTALL_DIR"

    log_step "正在备份配置文件..."
    cp .env .env.bak 2>/dev/null || true

    log_step "正在检查最新版本..."
    local latest_tag=$(get_latest_tag)
    if [ -f .env ]; then
        local current_tag=$(sed -n 's/^IMAGE_TAG=//p' .env 2>/dev/null || echo "latest")
        if [ "$current_tag" = "latest" ] && [ "$latest_tag" != "latest" ]; then
            log_info "更新 IMAGE_TAG: latest → ${latest_tag}"
            sed -i "s/IMAGE_TAG=.*/IMAGE_TAG=${latest_tag}/" .env
        fi
    fi

    log_step "正在下载最新配置文件..."
    local BASE_URL="https://raw.githubusercontent.com/jianming18/new-cloudpanel/refs/heads/main"
    curl -fsSL "${BASE_URL}/docker-compose.yml" -o docker-compose.yml || {
        log_error "下载 docker-compose.yml 失败"
        exit 1
    }

    mkdir -p config
    curl -fsSL "${BASE_URL}/config/nginx.conf" -o config/nginx.conf || {
        log_error "下载 nginx.conf 失败"
        exit 1
    }

    prepare_sqlite_storage
    
    log_info "正在拉取最新镜像..."
    docker compose pull

    log_step "正在重启服务..."
    docker compose up -d

    # 再次初始化（防止数据库结构变更）
    log_step "正在等待服务就绪..."
    wait_for_container

    log_info "正在初始化 AMI 镜像..."
    run_django_command "python manage.py aws_update_images"

    echo ""
    echo -e "${GREEN}CloudPanel 升级完成！${NC}"
    echo -e "您可以访问 http://<YourIP>:8086 查看效果"
    exit 0
}

# 安装逻辑函数
do_install() {
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  CloudPanel 一键安装脚本${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""

    check_root
    detect_os
    install_docker
    install_compose

    # 检查是否已安装
    if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
        log_warn "$INSTALL_DIR 似乎已存在"
        read -p "是否覆盖安装? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            log_info "安装已取消"
            exit 0
        fi
        rm -rf "$INSTALL_DIR"
    fi

    log_step "创建目录: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"/{data,logs,config}

    log_step "下载配置文件..."
    local BASE_URL="https://raw.githubusercontent.com/jianming18/new-cloudpanel/refs/heads/main"
    curl -fsSL "${BASE_URL}/docker-compose.yml" -o "$INSTALL_DIR/docker-compose.yml" || {
        log_error "下载 docker-compose.yml 失败"
        exit 1
    }

    curl -fsSL "${BASE_URL}/config/nginx.conf" -o "$INSTALL_DIR/config/nginx.conf" || {
        log_error "下载 nginx.conf 失败"
        exit 1
    }

    log_step "生成 .env 配置文件..."
    local SECRET_KEY=$(openssl rand -base64 48 2>/dev/null || python3 -c "import secrets; print(secrets.token_urlsafe(50))")

    cat > "$INSTALL_DIR/.env" << EOF
# CloudPanel 自动生成的配置文件
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

DEBUG=0
DJANGO_SETTINGS_MODULE=panelProject.settings

# Redis配置
REDIS_HOST=redis
REDIS_PORT=6379

# SQLite 数据库路径
SQLITE_PATH=/home/python/panel/data/db.sqlite3

# 时区设置
TZ=Asia/Shanghai

# 安全设置
DJANGO_SECRET_KEY=${SECRET_KEY}
ALLOWED_HOSTS=*
CORS_ALLOWED_ORIGINS=http://localhost:8086,http://127.0.0.1:8086

# 镜像版本 (latest=最新版, 或指定版本如 1.0.0)
IMAGE_TAG=$(get_latest_tag)

# 端口设置
FRONTENDPORT=8086
BACKENDPORT=889

# Gunicorn配置，低配机器建议保持2或1
GUNICORN_WORKERS=2
GUNICORN_TIMEOUT=120
EOF

    cd "$INSTALL_DIR"
    prepare_sqlite_storage
    
    log_step "开始拉取镜像并启动服务..."
    $COMPOSE_CMD up -d

    # 关键步骤：等待数据库就绪
    wait_for_container

    # 关键步骤：执行初始化管理命令
    init_admin

    # 关键步骤：初始化 AWS 镜像
    log_info "正在初始化 AWS 镜像数据..."
    run_django_command "python manage.py aws_update_images"

    show_success
}

# 辅助函数：等待容器就绪
wait_for_container() {
    log_info "正在等待服务启动（最多等待 30 秒）..."
    local count=0
    while [ $count -lt 30 ]; do
        if curl -sf http://localhost:${BACKENDPORT:-889}/health/ &>/dev/null; then
            break
        fi
        sleep 1
        count=$((count + 1))
    done
    
    if [ $count -ge 30 ]; then
        log_error "服务启动超时，请检查日志: docker logs $SERVICE_CONTAINER"
        exit 1
    fi
    log_info "服务启动成功"
}

# 辅助函数：修复 SQLite 存储路径
prepare_sqlite_storage() {
    mkdir -p data logs

    if [ -d "data/db.sqlite3" ]; then
        if [ -z "$(ls -A data/db.sqlite3 2>/dev/null)" ]; then
            log_warn "检测到 data/db.sqlite3 是空目录，正在修复为 SQLite 数据库文件"
            rmdir data/db.sqlite3
        else
            log_error "data/db.sqlite3 是非空目录，无法作为 SQLite 数据库文件使用。请先备份并手动处理该目录。"
            exit 1
        fi
    fi

    if [ -e "data/db.sqlite3" ] && [ ! -f "data/db.sqlite3" ]; then
        log_error "data/db.sqlite3 已存在但不是普通文件，无法作为 SQLite 数据库使用"
        exit 1
    fi

    touch data/db.sqlite3 || {
        log_error "无法创建或写入 data/db.sqlite3"
        exit 1
    }
}

# 辅助函数：执行 Django 命令
run_django_command() {
    local cmd="$1"
    if ! docker compose exec -T $COMPOSE_SVC $cmd; then
        log_error "执行命令 $cmd 失败"
        return 1
    fi
}

# 辅助函数：创建默认管理员
init_admin() {
    log_info "正在创建默认管理员账户 (admin/admin123)..."
    
    # 检查用户是否存在
    local check_cmd="import django; django.setup(); from django.contrib.auth.models import User; print(User.objects.filter(username='admin').exists())"
    local exists=$(docker compose exec -T $COMPOSE_SVC python -c "$check_cmd" 2>/dev/null)

    if [ "$exists" != "True" ]; then
        log_info "创建管理员..."
        docker compose exec -T $COMPOSE_SVC python -c "
# 自动建用户不打印任何多余提示
import django; django.setup()
from django.contrib.auth.models import User
try:
    User.objects.create_superuser('admin', 'admin@admin.com', 'admin123')
    print('SUCCESS')
except Exception as e:
    print(f'ERROR: {e}')
" 2>/dev/null || true
    else
        log_info "管理员账号已存在，跳过创建"
    fi
}

# 打印成功信息
show_success() {
    local SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "<YourServerIP>")
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  CloudPanel 安装完成!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo -e "  访问地址: ${BLUE}http://${SERVER_IP}:8086${NC}"
    echo -e "  管理后台: ${BLUE}http://${SERVER_IP}:${FRONTENDPORT:-8086}/${NC}"
    echo -e "  默认账号: ${YELLOW}admin${NC}"
    echo -e "  默认密码: ${YELLOW}admin123${NC}"
    echo -e "${GREEN}======================================${NC}"
}

# ------------------------------------------
# 主程序入口 - 解析参数
# ------------------------------------------

ACTION="${1}"

case "$ACTION" in
    uninstall)
        do_uninstall
        ;;
    update)
        do_update
        ;;
    *)
        do_install
        ;;
esac
