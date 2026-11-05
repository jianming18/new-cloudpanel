from __future__ import absolute_import
from celery import shared_task
from apps.azure.models import Account, Vm
from apps.users.models import CommonLogs



@shared_task()
def task_update_az(account_id):
    account_info = Account.objects.filter(id=account_id).first()

    if not account_info:
        return '账号不存在', False

    account_info.update_subscriptions()
    account_info.update_vm_list()

    for _vm in Vm.objects.filter(account_id=account_info.id):
        _vm.update_vm_info()
    return '更新完成', True


# 更新 do 账号信息
@shared_task()
def update_account(account_id, account=True, vm=True):

    account_info = Account.objects.filter(id=account_id).first()

    if not account_info:
        return '账号不存在', False

    # 更新 账号信息
    if account:
        account_info.update_subscriptions()

    # 更新 do 实例
    if vm:
        account_info.update_vm_list()

    return '更新完成', True

@shared_task()
def update_azure_vm(vm_id):
    vm_info = Vm.objects.filter(id=vm_id).first()
    if not vm_info:
        return 'VM 实例不存在', False
    vm_info.update_vm_info()
    return '更新完成', True

# 异步操作更改IP地址
@shared_task()
def azure_vm_change_ip(vm_id):
    vm_info = Vm.objects.filter(id=vm_id).first()
    if not vm_info:
        return False
    vm_info.ip = ''
    vm_info.save()
    vm_info.reset_ip()
    return True

# 异步添加服务器
@shared_task()
def azure_vm_create(account_id, vm_name, vm_size, image, location='eastasia', username='azureuser', password='@RqnEy7VSf4w', disk_size=64, group_name='AZURE_GROUP'):
    account_info = Account.objects.filter(id=account_id).first()
    if not account_info:
        return False
    result, status = account_info._creae_vm(vm_name, vm_size, image, location, username, password, disk_size, group_name)
    CommonLogs.create_logs('创建虚拟机', f'账号: {account_info.email}  返回信息: {result}  返回状态: {status}')
    return True

@shared_task()
def beat_update_azure_account():
    for _account in Account.objects.filter(status__in=['Enabled', 'Warned']):
        task_update_az.delay(_account.id)
    return True


if __name__ == '__main__':
    pass
