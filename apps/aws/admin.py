from django.contrib import admin

import json

# Register your models here.
from .models import Account, Lightsail, Ec2, GlobalAccelerator, Ec2Images
@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    search_fields = ['users__username', 'name', 'email', 'key_id', 'secret']

    list_filter = ('value', )

    list_display = ('id', 'name', 'users', 'email', 'password', 'status', 'get_ec2_count', 'value', 'ip', 'sale', 'price' ,'note', 'create_time', 'update_time')


@admin.register(Lightsail)
class LightsailAdmin(admin.ModelAdmin):

    # 地区
    def get_region(self, obj):
        # print(obj.hardware)
        return get_regions(json.loads(obj.location)['regionName'])

    # 配置信息
    def get_hardware(self, obj):
        try:
            hardware = json.loads(obj.hardware)
            return f"CPU: {hardware['cpuCount']}H 内存: {hardware['ramSizeInGb']}GB"
        except:
            return '获取失败'

    get_region.short_description = '地区'
    get_hardware.short_description = '配置信息'

    autocomplete_fields = ["users"]

    search_fields = ['public_ip', 'name', 'users__username']

    ordering = ('create_time', 'id')

    list_filter = ('api',)

    list_display = ('id', 'account', 'name', 'public_ip', 'private_ip', 'get_region', 'get_hardware', 'bundle_id', 'price', 'create_time', 'update_time')

# 实例
@admin.register(Ec2)
class Ec2Admin(admin.ModelAdmin):
    # 地区
    def get_region(self, obj):
        # print(obj.hardware)
        return get_regions(obj.region)

    get_region.short_description = '地区'

    # 搜索
    search_fields = ['public_ip', 'name', 'instance_id', 'users__username']

    list_filter = ('account', 'status', 'instance_type')

    ordering = ('create_time', 'id')

    list_display = ('id', 'account', 'users', 'name', 'instance_id', 'public_ip', 'private_ip', 'get_region', 'instance_type', 'status', 'create_time', 'update_time')


@admin.register(GlobalAccelerator)
class GlobalAcceleratorAdmin(admin.ModelAdmin):

    autocomplete_fields = ["instance"]

    ordering = ('create_time', 'id')

    # 搜索
    search_fields = ['ip_address', 'name', 'dns_name']

    # 选择框
    list_filter = ('account', 'status', 'enabled')

    list_display = ('id', 'account', 'instance', 'name', 'get_ip_address', 'dns_name', 'status', 'enabled', 'note', 'create_time', 'update_time')


@admin.register(Ec2Images)
class Ec2ImagesAdmin(admin.ModelAdmin):
    list_display = (
    'id', 'name', 'ami', 'region')
    # 选择框
    list_filter = ('region', 'name')

# aws 地区
def get_regions(name):
    regions = {
        'us-east-2': '美国-俄亥俄',
        'us-east-1': '美国-弗吉尼亚',
        'us-west-1': '美国-加利福尼亚',
        'us-west-2': '美国-俄勒冈',
        'ap-east-1': '中国-香港',
        'af-south-1': '非洲-开普敦',
        'ap-south-1': '印度-孟买',
        'ap-northeast-3': '日本-大阪',
        'ap-northeast-2': '韩国-首尔',
        'ap-southeast-1': '新加坡',
        'ap-southeast-2': '澳洲-悉尼',
        'ap-northeast-1': '日本-东京',
        'ca-central-1': '加拿大',
        'cn-north-1': '中国-北京',
        'cn-northwest-1': '中国-宁夏',
        'eu-central-1': '德国-法蘭克福',
        'eu-west-1': '愛爾蘭',
        'eu-west-2': '英国-倫敦',
        'eu-south-1': '意大利-米蘭',
        'eu-west-3': '法国-巴黎',
        'eu-north-1': '瑞典-斯德哥爾摩',
        'me-south-1': '中东-巴林',
        'sa-east-1': '巴西-圣保罗',
    }
    return regions.get(name, name)

