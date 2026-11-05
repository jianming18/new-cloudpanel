from django.core.management.base import BaseCommand

from apps.aws.models import Account




class Command(BaseCommand):
    help = '亚马逊未更新配额实例'

    def handle(self, *args, **options):

        for _account in Account.objects.filter(value=5):
            print(f'正在更新 {_account.name} 状态')
            _account.update_ready_status()
            _account.update_service_quota()

