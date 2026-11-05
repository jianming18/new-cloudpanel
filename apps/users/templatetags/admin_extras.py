from django import template
from django.urls import NoReverseMatch, reverse

register = template.Library()


@register.filter
def split(value, sep):
    return value.split(sep)


@register.simple_tag
def cloud_stats():
    """后台首页概览: 只读计数, 全部带列表跳转。"""
    from django.contrib.auth.models import User

    from apps.aws.models import Account as AwsAccount, Ec2, Lightsail
    from apps.azure.models import Vm as AzureVm
    from apps.do.models import Droplets
    from apps.linode.models import Vm as LinodeVm

    items = [
        ('AWS 账号', AwsAccount.objects.count(), 'admin:aws_account_changelist'),
        ('EC2 实例', Ec2.objects.exclude(status='terminated').count(), 'admin:aws_ec2_changelist'),
        ('轻量实例', Lightsail.objects.count(), 'admin:aws_lightsail_changelist'),
        ('Azure 实例', AzureVm.objects.count(), 'admin:azure_vm_changelist'),
        ('DO 实例', Droplets.objects.count(), 'admin:do_droplets_changelist'),
        ('Linode 实例', LinodeVm.objects.count(), 'admin:linode_vm_changelist'),
        ('面板用户', User.objects.count(), 'admin:auth_user_changelist'),
    ]

    stats = []
    for label, value, url_name in items:
        try:
            url = reverse(url_name)
        except NoReverseMatch:
            url = ''
        stats.append({'label': label, 'value': value, 'url': url})
    return stats

