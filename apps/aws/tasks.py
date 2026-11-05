from __future__ import absolute_import
import json
from celery import shared_task
import datetime
from apps.aws.models import Account as AwsAccount, Ec2, Lightsail

# 更新 aws ec2
@shared_task()
def aws_update_ec2(account_id, region_name=''):
    account_info = AwsAccount.objects.filter(id=account_id).first()
    if not account_info:
        return '账号不存在', False
    account_info.update_ec2(region_name)
    return True

# 更新配额
@shared_task()
def update_service_quota(account_id):
    account_info = AwsAccount.objects.filter(id=account_id).first()
    if not account_info:
        return '账号不存在', False
    account_info.update_service_quota()
    return True

@shared_task()
def update_all_aws_status():
    account_list = AwsAccount.objects.filter(value=5)
    for account in account_list:
        update_aws_account_status.delay(account.id)
    return True

@shared_task()
def update_aws_account_status(account_id):
    account_info = AwsAccount.objects.filter(id=account_id).first()
    if not account_info:
        return f'{account_id} 账号不存在', False

    # 先更新配额
    account_info.update_service_quota()

    # 检测账号状态
    account_info.update_ready_status()
    return '更新成功', True

@shared_task()
def update_aws(account_id, full=True):
    account_info = AwsAccount.objects.filter(id=account_id).first()
    if not account_info:
        return f'{account_id} 账号不存在', False

    # 先更新配额
    account_info.update_service_quota()

    # 检测账号状态
    account_info.update_ready_status()

    if not account_info.status or account_info.value == 0:
        return f'{account_info.name} - {account_info.email} 账号无效', False

    # 更新 轻量
    # account_info.update_lightsail()

    now_time = datetime.datetime.now()

    if account_info.ec2:
        if full:
            # 全量更新
            print(f'{account_info.name} - {account_info.email} 正在更新所有地区EC2实例')
            account_info.update_ec2()
            print(f'{account_info.name} - {account_info.email} 正在更新所有地区轻量服务器')
            account_info.update_lightsail()
        else:
            # 按照目前所有地区进行更新
            # print(f'{account_info.name} - {account_info.email} 正在更新EC2实例')


            for region in Ec2.objects.filter(account_id=account_id).order_by('region').values_list('region', flat=True).distinct():
                print(f'{account_info.name} - {account_info.email} 正在更新 {region} 地区EC2实例')
                account_info.update_ec2(region)

            if account_info.get_ec2_count() == 0:
                account_info.update_ec2('us-east-2')

            for region in Lightsail.objects.filter(account_id=account_id).order_by('location').values_list('location', flat=True).distinct():
                _region = json.loads(region)['availabilityZone']
                print(f'{account_info.name} - {account_info.email} 正在更新 {_region} 地区轻量实例')
                account_info.update_lightsail(_region)
        Ec2.objects.filter(update_time__lt=now_time, account_id=account_id).delete()

    return f'{account_info.name} - {account_info.email} 更新完成', True

# 轻量实例更换IP
@shared_task()
def ls_reset_ip(ls_id):
    Lightsail.objects.filter(id=ls_id).first().reset_ip()
    return True

# 更新非正常状态的ec2
@shared_task()
def check_ec2(ec2_id):
    data_info = Ec2.objects.filter(id=ec2_id).first()
    if not data_info:
        return False
    return data_info.update_info()

@shared_task()
def beat_check_ec2():
    data_info = Ec2.objects.exclude(status__in=['running', 'terminated']).filter(account__status=True)
    for ec2 in data_info:
        check_ec2.delay(ec2.id)
    return True

@shared_task()
def check_reset_ip():
    for foo in Lightsail.objects.filter(price__gte=5, api=True):
        ls_reset_ip.delay(foo.id)
    return True

@shared_task()
def update_all_account():
    for foo in AwsAccount.objects.filter().exclude(value=0):
        update_aws(foo.id)
    return True

# 每一小时更新一次所有账号的配额
@shared_task()
def beat_update_value():
    for foo in AwsAccount.objects.filter().exclude(value=0):
        foo.update_service_quota()
    return True




if __name__ == '__main__':
    pass
