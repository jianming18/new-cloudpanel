from django.db import models

from libs.do import DoApi

import datetime

# Create your models here.
class Account(models.Model):
    name = models.CharField('名称', max_length=200, default='', null=True, blank=True)
    email = models.EmailField('Email', default='', blank=True)
    uuid = models.CharField('UUID', max_length=100, default='', blank=True)
    password = models.CharField('密码', max_length=255, default='', blank=True)
    token = models.CharField('Token', max_length=100, db_index=True, unique=True)

    status = models.CharField('状态', max_length=25, default='', blank=True)

    droplet_limit = models.PositiveSmallIntegerField('配额', default=0)


    month_to_date_balance = models.CharField('余额', max_length=25, default='', blank=True)
    account_balance = models.CharField('余额', max_length=25, default='', blank=True)
    month_to_date_usage = models.CharField('余额', max_length=25, default='', blank=True)

    note = models.CharField('备注信息', max_length=50, default='', blank=True)

    create_time = models.DateTimeField('创建时间', null=True, auto_now_add=True)
    update_time = models.DateTimeField('更新时间', null=True, auto_now=True)

    def __str__(self):
        return self.email

    class Meta:
        verbose_name = "账号列表"
        verbose_name_plural = verbose_name

    # 更新账号基本信息
    def update_account(self):
        doApi = DoApi(self.token)

        # 获取基本信息
        if not doApi.get_account(): return '获取账户信息失败', False

        self.email = doApi.account_info['email']
        if self.name == '': self.name = self.email
        # print(doApi.account_info)
        self.uuid = doApi.account_info['uuid']
        self.status = doApi.account_info['status']
        self.droplet_limit = doApi.account_info['droplet_limit']


        if doApi.get_balance():

            self.account_balance = doApi.balance_info.get('account_balance', 0)
            self.month_to_date_balance = doApi.balance_info.get('month_to_date_balance', 0)
            # print(self.month_to_date_balance)
        # self.month_to_date_balance = doApi.balance_info['month_to_date_balance']

        # self.month_to_date_usage = doApi.balance_info['month_to_date_usage']
        self.save()

        return '更新完成', True

    # 获取全部实例
    def update_droplets(self):
        try:
            now_time = datetime.datetime.now()
            doApi = DoApi(self.token)
            doApi.get_droplets()
            # print(self.token, len(doApi.droplets))
            for droplet in doApi.droplets:
                # print(droplet)
                droplet.update({
                    'account_id': self.id
                })
                if Droplets.objects.filter(droplet_id=droplet['droplet_id']).first():
                    # print('111')
                    # 更新
                    droplet.update({
                        'update_time': datetime.datetime.now()
                    })
                    Droplets.objects.filter(droplet_id=droplet['droplet_id']).update(**droplet)
                    continue
                # 新建的实例可能是刚从面板创建的, 把当时下发的 root 密码补进来
                password = DoApi.pop_password(droplet['droplet_id'])
                if password:
                    droplet.update({'password': password})
                Droplets.objects.create(**droplet)
                continue
            Droplets.objects.filter(update_time__lt=now_time, account_id=self.id).delete()
            return True
        except BaseException as e:
            print(e)
            return False

    def get_server_count(self):
        return Droplets.objects.filter(account_id=self.id).count()

 # 实例列表
class Droplets(models.Model):
    account = models.ForeignKey('Account', on_delete=models.CASCADE, verbose_name='所属账号',
                                related_name='droplet_account')
    droplet_id = models.IntegerField('实例ID')
    name = models.CharField('实例名称', max_length=200, db_index=True)
    ip = models.GenericIPAddressField('公网IP', default='', db_index=True, null=True, blank=True)
    memory = models.PositiveSmallIntegerField('内存大小', default=0)
    vcpus = models.PositiveSmallIntegerField('CPU核心', default=0)
    disk = models.PositiveSmallIntegerField('硬盘大小', default=0)

    status_choices = (
        ('active', '运行中'),
        ('pending', '启动中'),
        ('stopped', '已停止'),
        ('stopping', '停止中'),
    )

    status = models.CharField('实例状态', choices=status_choices, max_length=20, default='running')


    size_slug = models.CharField('实例规格', max_length=50, default='', blank=True)
    image_slug = models.CharField('镜像ID', max_length=50, default='', blank=True)
    region_slug = models.CharField('地区ID', max_length=50, default='', blank=True)
    note = models.CharField('备注信息', max_length=50, default='', blank=True)

    password = models.CharField('root密码', max_length=255, default='', blank=True)

    create_time = models.DateTimeField('创建时间', null=True)
    update_time = models.DateTimeField('更新时间', null=True, auto_now=True)

    def __str__(self):
        return self.ip

    class Meta:
        verbose_name = "实例列表"
        verbose_name_plural = verbose_name