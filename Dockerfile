FROM --platform=$TARGETPLATFORM python:3.11-slim

ARG VERSION=dev
LABEL maintainer="jianming18"
LABEL org.opencontainers.image.source="https://github.com/jianming18/new-cloudpanel"
LABEL org.opencontainers.image.description="CloudPanel - 多云服务管理平台"
LABEL org.opencontainers.image.version="${VERSION}"

# 设置环境变量以减少Python生成的.pyc文件
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai

# 安装系统依赖
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        supervisor \
        curl \
        netcat-traditional \
    && rm -rf /var/lib/apt/lists/* \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && mkdir -p /home/python \
    && python -m pip install --no-cache-dir --upgrade pip

WORKDIR /home/python/panel

# 预编译 wheel 包仓库: 所有依赖已锁定版本并预先下载好, 构建时完全离线安装
COPY wheels/ /wheels/
COPY requirements.txt .

# 安装Python依赖 (离线, 不联网不解析, 小内存机器友好)
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# 复制项目文件
COPY . .

# 写入版本号
RUN echo "${VERSION}" > /etc/cloudpanel-version

# 创建必要的目录并设置配置文件
RUN mkdir -p /etc/supervisor/conf.d \
    && mkdir -p data \
    && mkdir -p logs \
    && cp ./config/celery-beat.conf /etc/supervisor/conf.d/ \
    && cp ./config/celery-worker.conf /etc/supervisor/conf.d/ \
    && cp ./config/django-server.conf /etc/supervisor/conf.d/ \
    && chmod +x entrypoint.sh \
    && rm -rf .git

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:889/health/ || exit 1

ENTRYPOINT ["./entrypoint.sh"]
