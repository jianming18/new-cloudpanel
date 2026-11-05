from __future__ import absolute_import
from celery import shared_task

from apps.do.models import Account

# 更新 do 账号信息
@shared_task()
def beat_update_do_account(account_id=None, account=True, droplet=True):
    if account_id is None:
        for account_info in Account.objects.all():
            beat_update_do_account(account_info.id, account=account, droplet=droplet)
        return True

    account_info = Account.objects.filter(id=account_id).first()

    if not account_info:
        return '账号不存在', False

    # 更新 账号信息
    if account:
        account_info.update_account()

    # 更新 do 实例
    if droplet:
        account_info.update_droplets()

    return True


if __name__ == '__main__':
    pass
