import json

from django.contrib import admin

from apps.users.admin_utils import mask

from .models import Account, Lightsail, Ec2, GlobalAccelerator, Ec2Images


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'users', 'email', 'key_id', 'masked_secret',
        'status', 'instance_count', 'value', 'sale', 'price', 'note', 'create_time',
    )
    list_display_links = ('id', 'name')
    list_filter = ('status', 'sale', 'ec2', 'aga', 'auto_boot', 'value')
    search_fields = ('name', 'email', 'key_id', 'note', 'users__username')
    autocomplete_fields = ('users',)
    ordering = ('-id',)
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')
    fieldsets = (
        ('归属', {'fields': ('users', 'name', 'email', 'note')}),
        ('凭证', {
            'fields': ('key_id', 'secret', 'password'),
            'description': '凭证仅超级管理员可见，修改后请确认对应实例仍可正常同步。',
        }),
        ('业务开关', {'fields': ('status', 'auto_boot', 'sale', 'price', 'aga', 'ec2', 'value')}),
        ('其他', {'fields': ('ip', 'card')}),
        ('时间', {'fields': ('create_time', 'update_time'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Secret')
    def masked_secret(self, obj):
        return mask(obj.secret)

    @admin.display(description='实例数 (EC2 / 轻量)')
    def instance_count(self, obj):
        return obj.get_ec2_count()


@admin.register(Lightsail)
class LightsailAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'account', 'public_ip', 'private_ip', 'region_name',
        'hardware_info', 'status', 'price', 'api', 'create_time',
    )
    list_display_links = ('id', 'name')
    list_filter = ('status', 'api', 'account')
    search_fields = ('name', 'public_ip', 'private_ip', 'support_code', 'users__username')
    autocomplete_fields = ('account', 'users')
    list_select_related = ('account', 'users')
    ordering = ('-create_time', '-id')
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time', 'expire_time')

    @admin.display(description='地区')
    def region_name(self, obj):
        try:
            return get_regions(json.loads(obj.location)['regionName'])
        except (ValueError, KeyError, TypeError):
            return '—'

    @admin.display(description='配置')
    def hardware_info(self, obj):
        try:
            hardware = json.loads(obj.hardware)
            return f"{hardware['cpuCount']} 核 / {hardware['ramSizeInGb']} GB"
        except (ValueError, KeyError, TypeError):
            return '—'


@admin.register(Ec2)
class Ec2Admin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'account', 'users', 'instance_id', 'public_ip',
        'region_name', 'instance_type', 'status', 'price', 'create_time',
    )
    list_display_links = ('id', 'name')
    list_filter = ('status', 'instance_type', 'is_aga', 'account')
    search_fields = ('name', 'instance_id', 'public_ip', 'private_ip', 'note', 'users__username')
    autocomplete_fields = ('account', 'users')
    list_select_related = ('account', 'users')
    ordering = ('-create_time', '-id')
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time', 'expire_time')

    @admin.display(description='地区')
    def region_name(self, obj):
        return get_regions(obj.region)


@admin.register(GlobalAccelerator)
class GlobalAcceleratorAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'account', 'instance', 'ip_display', 'dns_name',
        'status', 'enabled', 'note', 'create_time',
    )
    list_display_links = ('id', 'name')
    list_filter = ('status', 'enabled', 'account')
    search_fields = ('name', 'ip_address', 'dns_name', 'arn')
    autocomplete_fields = ('account', 'instance')
    list_select_related = ('account', 'instance')
    ordering = ('-create_time', '-id')
    list_per_page = 25
    readonly_fields = ('create_time', 'update_time')

    @admin.display(description='IP 地址')
    def ip_display(self, obj):
        return ' / '.join(filter(None, obj.ip_address.split(','))) or '—'


@admin.register(Ec2Images)
class Ec2ImagesAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'ami', 'region_name', 'create_time', 'update_time')
    list_filter = ('region',)
    search_fields = ('name', 'ami', 'region')
    ordering = ('name', 'region')
    list_per_page = 50
    readonly_fields = ('create_time', 'update_time')

    @admin.display(description='地区')
    def region_name(self, obj):
        return get_regions(obj.region)


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

