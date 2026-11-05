from django.core.management.base import BaseCommand

from apps.linode.models import Account

class Command(BaseCommand):
    help = '更新Linode状态'

    def handle(self, *args, **options):

        for _account in Account.objects.filter():
            print(_account.get_account())
            _account.update_instances()
