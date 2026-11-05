from __future__ import absolute_import
from celery import shared_task
from apps.linode.models import Account



@shared_task()
def beat_update_linode_account():
    for _account in Account.objects.filter():
        # print(_account.get_account())
        _account.update_instances()
    return True


if __name__ == '__main__':
    pass
