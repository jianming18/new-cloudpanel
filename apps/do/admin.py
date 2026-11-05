from django.contrib import admin

from apps.users.admin_utils import mask

from .models import Account, Droplets


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'email', 'masked_token', 'status', 'droplet_limit',
        'month_to_date_balance', 'account_balance', 'server_count', 'note', 'create_time',
    )
    list_display_links = ('id', 'name')
    list_filter = ('status',)
    search_fields = ('name', 'email', 'uuid', 'note')
    ordering = ('-id',)
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')
    fieldsets = (
        ('账号', {'fields': ('name', 'email', 'uuid', 'note')}),
        ('凭证', {
            'fields': ('token', 'password'),
            'description': 'Token 仅超级管理员可见，修改后需要重新同步账号信息。',
        }),
        ('额度与状态', {'fields': ('status', 'droplet_limit', 'month_to_date_balance', 'account_balance', 'month_to_date_usage')}),
        ('时间', {'fields': ('create_time', 'update_time'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Token')
    def masked_token(self, obj):
        return mask(obj.token)

    @admin.display(description='实例数')
    def server_count(self, obj):
        return obj.get_server_count()


@admin.register(Droplets)
class DropletsAdmin(admin.ModelAdmin):
    list_display = (
        'droplet_id', 'name', 'account', 'ip', 'status', 'memory', 'vcpus', 'disk',
        'size_slug', 'region_slug', 'masked_password', 'create_time',
    )
    list_display_links = ('droplet_id', 'name')
    list_filter = ('status', 'region_slug', 'account')
    search_fields = ('name', 'ip', 'droplet_id', 'size_slug', 'image_slug', 'note')
    autocomplete_fields = ('account',)
    list_select_related = ('account',)
    ordering = ('-create_time', '-droplet_id')
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')

    @admin.display(description='root 密码')
    def masked_password(self, obj):
        return mask(obj.password)

