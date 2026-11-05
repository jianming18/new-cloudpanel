from django.core.management.base import BaseCommand
from django.core.management import execute_from_command_line
from django.conf import settings
from apps.aws.models import Account, Lightsail, Ec2, GlobalAccelerator
from libs.aws import AwsApi
from apps.aws.tasks import update_aws
import datetime

import _thread



class Command(BaseCommand):
    help = '更新亚马逊全部实例'

    def handle(self, *args, **options):
        # update_service_quota(2)
        # self.now_time = datetime.datetime.now()
        for _account in Account.objects.exclude(value=0, status=False):
            # print(_account.email)
            update_aws.delay(_account.id, False)
            #print(status, ret)


        # # 更新 do 全部账号
        # for _account in do_account.objects.filter():
        #     do_update_account(_account.id)
