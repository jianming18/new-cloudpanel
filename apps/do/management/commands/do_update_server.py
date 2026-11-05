from django.core.management.base import BaseCommand
from apps.do.models import Account as do_account



class Command(BaseCommand):
    help = '更新 DigitalOcean 全部实例'

    def handle(self, *args, **options):


        # 更新 do 全部账号
        for _account in do_account.objects.exclude(status='locked'):
            # do_update_account.delay(_account.id)
            print(f'正在更新： {_account.email}')
            _account.update_account()
            _account.update_droplets()
