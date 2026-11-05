from django.db import models
from django.core.cache import cache
from django.contrib.auth.models import User

from apps.users.models import CommonLogs
from libs.aws import get_regions, AwsApi, get_service_quota, USER_DATA
from libs.utils import DateTimeToStr

# from apps.aws.tasks import aws_update_ec2
import json, datetime


LS_LIST = [275]


# Create your models here.
class Account(models.Model):
    users = models.ForeignKey(User, verbose_name='所属用户', on_delete=models.SET_NULL, null=True, blank=True,
                              related_name='account_users')
    name = models.CharField('名称', max_length=200, default='')
    email = models.EmailField('Email', default='', blank=True)
    password = models.CharField('密码', max_length=255, default='', blank=True)
    key_id = models.CharField('KeyID', max_length=50)
    secret = models.CharField('Secret', max_length=100)
    status = models.BooleanField('是否启用', default=False)

    auto_boot = models.BooleanField('自动开机', default=False)

    sale = models.BooleanField('是否销售', default=False)
    price = models.IntegerField('价格', default=0)

    aga = models.BooleanField('支持AGA', default=False)
    ec2 = models.BooleanField('支持EC2', default=False)
    value = models.PositiveSmallIntegerField('账号等级', default=8)


    ip = models.GenericIPAddressField('注册IP', default='', null=True, blank=True)

    card = models.CharField('信用卡', max_length=20, default='', null=True, blank=True)

    note = models.CharField('备注信息', max_length=50, default='', blank=True)

    create_time = models.DateTimeField('创建时间', null=True, auto_now_add=True)
    update_time = models.DateTimeField('更新时间', null=True, auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "账号列表"
        verbose_name_plural = verbose_name

    # 获取销售列表
    def get_sale_list(self):
        pass

    # 获取ec2数量
    def get_ec2_count(self):
        ec2count = Ec2.objects.filter(account=self.id).exclude(status='terminated').count()
        lscount = Lightsail.objects.filter(account=self.id).count()
        return f'{ec2count} / {lscount}'

    # 获取全部地区配额
    def _get_service_quota(self):
        token = f'{self.id}-quota'
        ret = cache.get(token)
        if not ret:
            try:
                aApi = AwsApi()
                aApi.region = 'us-west-2'
                aApi.key_id = self.key_id
                aApi.key_secret = self.secret
                aApi.start('ec2')
                aApi.get_all_service_quota()
                cache.set(token, aApi.quota_list, 60 * 60 * 6)
                return aApi.quota_list
            except:
                return []
        else:
            return ret

    # 更新配额
    def update_service_quota(self):
        value = get_service_quota(self.key_id, self.secret)
        # print(self.value, value)
        if self.value != value:
            CommonLogs.create_logs('配额更新', f'账号: {self.name} 邮箱: {self.email} 原配额: {self.value} 新配额: {value}\n添加时间: {DateTimeToStr(self.create_time)}')
        if type(value) == bool:
            self.value = 0
        else:
            self.value = value
        self.save()
        return True

    # 检测账号状态
    def update_ready_status(self):
        try:
            aApi = AwsApi()
            aApi.region = 'us-west-2'
            aApi.key_id = self.key_id
            aApi.key_secret = self.secret
            aApi.start('ec2')
            aApi.client.describe_regions()
            if not Account.objects.filter(id=self.id).first().status:
                if str(self.value) in ["1", "5"] and self.auto_boot and self.get_ec2_count() == '0 / 0':
                    self.create_default_ec2()
                    self.auto_boot = False

            self.status = True
            self.save()
            return True
        except:
            self.status = False
            self.save()
            return False

    # 更新轻量实例
    def update_lightsail(self, region_name=''):
        now_time = datetime.datetime.now()
        try:
            aApi = AwsApi(self.key_id, self.secret)
            aApi.region = 'ap-south-1'
            aApi.start('lightsail')
            aApi.get_lightsail_full_instances(region_name)
            for instance in aApi.instances:
                instance.update({
                    'account_id': self.id
                })
                if Lightsail.objects.filter(support_code=instance['support_code']).first():
                    # 更新
                    instance.update({
                        'update_time': datetime.datetime.now()
                    })
                    Lightsail.objects.filter(support_code=instance['support_code']).update(**instance)
                    continue

                instance.update({
                    'expire_time': datetime.datetime.now()
                })
                Lightsail.objects.filter(support_code=instance['support_code']).create(**instance)
                continue
            Lightsail.objects.filter(update_time__lt=now_time, account_id=self.id).delete()
            return True
        except:
            return False

    # 更新EC2实例
    def update_ec2(self, region_name=''):
        try:
            aApi = AwsApi(self.key_id, self.secret)
            aApi.region = 'us-west-2'
            aApi.start('ec2')
            aApi.ec2_get_full_instances(region_name)
            for instance in aApi.instances:
                # print(instance)
                instance.update({
                    'account_id': self.id
                })
                if Ec2.objects.filter(instance_id=instance['instance_id']).first():
                    # 更新
                    instance.update({
                        'update_time': datetime.datetime.now()
                    })
                    Ec2.objects.filter(instance_id=instance['instance_id']).update(**instance)
                    continue

                instance.update({
                    'password': '',
                    'expire_time': datetime.datetime.now()
                })
                Ec2.objects.filter().create(**instance)
                continue
            # Ec2.objects.filter(update_time__lt=now_time, account_id=self.id).delete()
            return True
        except BaseException as e:
            print(e)
            return False

    # 更新 AGA
    def update_aga(self):
        now_time = datetime.datetime.now()
        try:
            aApi = AwsApi(self.key_id, self.secret)
            aApi.region = 'us-west-2'
            aApi.start('globalaccelerator')
            aApi.list_accelerators()
            for instance in aApi.instances:
                instance.update({
                    'account_id': self.id
                })
                if GlobalAccelerator.objects.filter(arn=instance['arn']).first():
                    # 更新
                    instance.update({
                        'update_time': datetime.datetime.now()
                    })
                    GlobalAccelerator.objects.filter(arn=instance['arn']).update(**instance)
                    continue

                GlobalAccelerator.objects.create(**instance)
                continue
            GlobalAccelerator.objects.filter(update_time__lt=now_time, account_id=self.id).delete()
            return True
        except:
            return False


    # 账号激活: 用官方 EC2 API 建一台默认实例
    # (旧实现会调用第三方 12999 服务并把 AccessKey 明文发过去, 已移除)
    def create_default_ec2(self):
        image_info = Ec2Images.objects.filter(region='us-east-2').order_by('-id').first() \
            or Ec2Images.objects.order_by('-id').first()
        if not image_info:
            return False

        device_name = 'sda1' if 'Debian' not in image_info.name else 'xvda'
        status, message = self.create_ec2(
            image_info.region, 't3.micro', f'{self.name}-auto'.lower(), 20,
            device_name, 1, 'Panel778899!', '', image_info.ami,
        )
        return status

    #
    def create_ec2(self, region, InstanceType, name, DiskSize, DeviceName, MaxCount, password, user_data, ami):

        aApi = AwsApi(self.key_id, self.secret)
        aApi.region = region
        _user_data = USER_DATA.replace('admin77889900==', password)
        _user_data += user_data

        aApi.ImageId = ami
        if not aApi.ec2_create_instances(InstanceType, name, DiskSize, DeviceName, MaxCount, _user_data):
            return False, '创建失败'

        Instances = aApi.response['Instances'][0]

        _data = {
            'users_id': self.users_id,
            'account_id': self.id,
            'region': region,
            'image_id': Instances['ImageId'],
            'instance_id': Instances['InstanceId'],
            'instance_type': Instances['InstanceType'],
            'create_time': Instances['LaunchTime'].strftime("%Y-%m-%d %H:%M:%S"),
            'status': Instances['State']['Name'],
            'private_ip': Instances['PrivateIpAddress'],
            'public_ip': Instances.get('PublicIpAddress', ''),
            'update_time': datetime.datetime.now(),
            'expire_time': datetime.datetime.now(),
            'password': password,
            'note': name
        }
        Ec2.objects.create(**_data)
        # apps.aws.tasks.aws_update_ec2.delay(self.id, region)

        return True, '创建成功'


# 轻量实例列表
class Lightsail(models.Model):
    account = models.ForeignKey('Account', on_delete=models.CASCADE, verbose_name='所属账号', related_name='lightsail_account')
    users = models.ForeignKey(User, verbose_name='所属用户', on_delete=models.SET_NULL, null=True, blank=True, related_name='lightsail_users')
    name = models.CharField('实例名称', max_length=200, db_index=True)
    public_ip = models.GenericIPAddressField('公网IP', default='', db_index=True, null=True, blank=True)
    private_ip = models.GenericIPAddressField('内网IP', default='', db_index=True)
    location = models.TextField('地区', default='{}')
    hardware = models.TextField('硬件信息', default='{}')
    os_name = models.CharField('系统名称', default='', max_length=50)
    os_id = models.CharField('镜像ID', default='', max_length=50)
    bundle_id = models.CharField('规格ID', default='', max_length=50)
    support_code = models.CharField('支持代码', default='', max_length=50)

    status_choices = (
        ('running', '运行中'),
        ('pending', '启动中'),
        ('stopped', '已停止'),
        ('stopping', '停止中'),
    )

    password = models.CharField('实例密码', max_length=255, default='', blank=True, null=True)

    status = models.CharField('实例状态', choices=status_choices, max_length=20, default='running')

    price = models.IntegerField('价格', default=0)

    api = models.BooleanField('API接口', default=False)

    note = models.CharField('备注信息', max_length=50, default='', blank=True)

    create_time = models.DateTimeField('创建时间', null=True)
    update_time = models.DateTimeField('更新时间', null=True, auto_now=True)
    expire_time = models.DateTimeField('到期时间', null=True, default=None, blank=True)


    def __str__(self):
        return self.name

    def get_region_name(self):
        return get_regions(json.loads(self.location)['regionName'])

    # 获取所属用户
    def get_username(self):
        if self.users == None: return '未绑定'
        return self.users.username

    def get_region(self):
        return json.loads(self.location)['regionName']

    # 重置IP
    def reset_ip(self):
        try:
            aApi = AwsApi()
            aApi.region = self.get_region()
            aApi.key_id = self.account.key_id
            aApi.key_secret = self.account.secret
            aApi.start('lightsail')
            static_ip_name = f"static_ip_{self.name}"
            aApi.lightsail_allocate_static_ip(static_ip_name)
            # 2, 为实例绑定静态ip
            aApi.lightsail_attach_static_ip(self.name, static_ip_name)
            # 3, 释放静态ip
            aApi.lightsail_release_static_ip(static_ip_name)
            instance = aApi.client.get_instance(instanceName=self.name)['instance']
            # print(ret)
            self.public_ip = instance.get('publicIpAddress', '')
            self.os_id = instance['blueprintId']
            self.os_name = instance['blueprintName']
            self.status = instance['state']['name']
            self.price = 0
            self.save()
            return self.public_ip
        except BaseException as e:
            print(e)
            return False

    class Meta:
        verbose_name = "轻量主机"
        verbose_name_plural = verbose_name

# EC2 实例
class Ec2(models.Model):
    account = models.ForeignKey('Account', on_delete=models.CASCADE, verbose_name='所属账号', related_name='ec2_account')
    users = models.ForeignKey(User, verbose_name='所属用户', on_delete=models.SET_NULL, null=True, blank=True, related_name='ec2_users')
    name = models.CharField('实例名称', max_length=200, default='-', blank=True)
    public_ip = models.GenericIPAddressField('公网IP', default='', db_index=True, null=True, blank=True)
    private_ip = models.GenericIPAddressField('内网IP', default='', db_index=True, null=True, blank=True)
    region = models.CharField('实例地区', default='', max_length=50)
    image_id = models.CharField('镜像ID', default='', max_length=50)
    instance_type = models.CharField('实例规格', default='', max_length=50)
    instance_id = models.CharField('实例ID', default='', max_length=50, db_index=True)

    status_choices = (
        ('running', '运行中'),
        ('pending', '启动中'),
        ('stopped', '已停止'),
        ('stopping', '停止中'),
        ('terminated', '已终止'),
        ('shutting-down', '正在关闭'),
    )

    is_aga = models.BooleanField('支持AGA', default=False)

    status = models.CharField('实例状态', choices=status_choices, max_length=20, default='running')

    price = models.IntegerField('价格', default=0)

    note = models.CharField('备注信息', max_length=50, default='', blank=True)

    password = models.CharField('实例密码', max_length=255, default='', blank=True, null=True)

    create_time = models.DateTimeField('创建时间', null=True)
    update_time = models.DateTimeField('更新时间', null=True, auto_now=True)
    expire_time = models.DateTimeField('到期时间', null=True, default=None, blank=True)

    def __str__(self):
        return f"{self.instance_id}-{self.get_region_name()}"

    def get_region_name(self):
        return get_regions(self.region)

    # 获取所属用户
    def get_username(self):
        if self.account.users == None: return '未绑定'
        return self.account.users.username

    # 更新实例状态
    def update_info(self):
        aApi = AwsApi()
        aApi.key_id = self.account.key_id
        aApi.key_secret = self.account.secret
        aApi.region = self.region
        aApi.start('ec2')
        try:
            _instance = aApi.client.describe_instances(InstanceIds=[self.instance_id])['Reservations'][0]['Instances'][0]
        except BaseException as e:
            print(e)
            return False

        _data = {
            # 'name': name,
            'image_id': _instance['ImageId'],
            'instance_id': _instance['InstanceId'],
            'instance_type': _instance['InstanceType'],
            'create_time': (_instance['LaunchTime'] + datetime.timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"),
            'status': _instance['State']['Name'],
            'public_ip': _instance.get('PublicIpAddress', ''),
            'private_ip': _instance.get('PrivateIpAddress', ''),
            'update_time': datetime.datetime.now()
        }

        for _tag in _instance.get('Tags', []):
            if _tag.get('Key', '') not in 'Name': continue
            name = _tag.get('Value', '-')
            _data.update({'name': name})
        Ec2.objects.filter(id=self.id).update(**_data)
        return True

    class Meta:
        verbose_name = "EC2"
        verbose_name_plural = verbose_name

# 全球加速器
class GlobalAccelerator(models.Model):
    account = models.ForeignKey('Account', on_delete=models.CASCADE, verbose_name='所属账号', related_name='aga_account')
    instance = models.ForeignKey(Ec2, verbose_name='绑定实例', on_delete=models.SET_NULL, null=True, blank=True, related_name='aga_instance')

    arn = models.CharField('ARN', max_length=255, default='', unique=True)
    ip_address = models.CharField('IP地址', max_length=255, default='', blank=True)

    name = models.CharField('实例名称', max_length=200, default='-', blank=True)
    dns_name = models.CharField('域名', max_length=200, default='-', blank=True)

    status_choices = (
        ('DEPLOYED', '部署完成'),
        ('IN_PROGRESS', '部署中')
    )

    status = models.CharField('实例状态', choices=status_choices, max_length=20, default='IN_PROGRESS')

    enabled = models.BooleanField('是否启用', default=False)

    note = models.CharField('备注信息', max_length=50, default='', blank=True)

    create_time = models.DateTimeField('创建时间', null=True)
    update_time = models.DateTimeField('更新时间', null=True, auto_now=True)

    def __str__(self):
        return self.ip_address

    def get_ip_address(self):
        return '--'.join(self.ip_address.split(','))

    def get_instance(self):
        if self.instance == None: return '未选择'

    get_ip_address.short_description = 'IP地址'

    class Meta:
        verbose_name = "全球加速器"
        verbose_name_plural = verbose_name

# EC2 镜像
class Ec2Images(models.Model):
    name = models.CharField('镜像名称', max_length=200, db_index=True)
    ami = models.CharField('镜像ID', max_length=50, unique=True, db_index=True)
    region = models.CharField('地区', default='', max_length=50)

    create_time = models.DateTimeField('创建时间', auto_now_add=True, null=True)
    update_time = models.DateTimeField('更新时间', null=True, auto_now=True)


    def __str__(self):
        return self.name

    def get_region_name(self):
        return get_regions(self.region)

    @classmethod
    def get_region_images(cls, region):
        ret = cls.objects.filter(region=region).values('name', 'ami')
        return ret

    @classmethod
    def get_images_name(cls, ami):
        try:
            return cls.objects.filter(ami=ami).first().name
        except:
            return ami

    class Meta:
        verbose_name = "EC2镜像"
        verbose_name_plural = verbose_name
