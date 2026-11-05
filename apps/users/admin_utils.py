def mask(value, keep=4):
    """列表页只露尾部几位, 避免 Token / 密码在列表上明文展示。"""
    if not value:
        return '—'
    value = str(value)
    if len(value) <= keep:
        return '•' * len(value)
    return '•' * 8 + value[-keep:]


def preview(value, limit=40):
    """长文本在列表页截断, 详情页仍看完整内容。"""
    if not value:
        return '—'
    value = str(value).replace('\n', ' ')
    return value if len(value) <= limit else f'{value[:limit]}…'
