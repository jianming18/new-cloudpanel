def _to_int(value, default):
    """把 query string 里的分页参数安全转换成整数, 非法值一律回落到默认值"""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def should_auto_sync(key, ttl=30):
    """节流: 同一 key 在 ttl 秒内只允许触发一次云端状态同步。
    用于实例列表发现过渡态实例时自动派发同步任务, 避免前端轮询把云厂商 API 打爆。
    返回 True 表示本次允许同步 (调用方负责以 celery .delay 方式派发)"""
    from django.core.cache import cache
    if cache.get(key):
        return False
    cache.set(key, 1, ttl)
    return True


def dispatch_task(task_func, *args, **kwargs):
    """安全派发 celery 任务: broker 不可用时静默降级, 不影响列表接口正常返回"""
    try:
        task_func.delay(*args, **kwargs)
    except Exception as e:
        print(f'派发任务 {getattr(task_func, "name", task_func)} 失败: {e}')


# 分页
def Pagination(page, limit, dataLen=999):
    # 前端可能不传 page, 也可能传入非法值, 这里统一收敛, 避免出现字符串切片导致 500
    page = max(_to_int(page, 1), 1)
    limit = max(_to_int(limit, 25), 1)

    if page == 1:
        return 0, limit

    end = limit * page
    if dataLen is not None and dataLen < limit:
        return 0, end
    return end - limit, end

def DateTimeToStr(_datetime):
    try:
        return _datetime.strftime("%Y-%m-%d %H:%M:%S")
    except:
        return str(_datetime)


def md5(str):
    import hashlib
    m2 = hashlib.md5()
    m2.update(str.encode("utf-8"))
    return m2.hexdigest()


if __name__ == '__main__':
    pass
