from django.contrib import admin

from apps.users.admin_utils import mask

from .models import Account, Vm


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'display_name', 'users', 'email', 'subscription_id', 'masked_secret',
        'status', 'vm_count', 'note', 'create_time',
    )
    list_display_links = ('id', 'display_name')
    list_filter = ('status', 'update')
    search_fields = ('display_name', 'email', 'subscription_id', 'client_id', 'tenant_id', 'note', 'users__username')
    autocomplete_fields = ('users',)
    ordering = ('-id',)
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')
    fieldsets = (
        ('归属', {'fields': ('users', 'display_name', 'email', 'note')}),
        ('凭证', {
            'fields': ('subscription_id', 'client_id', 'tenant_id', 'password', 'login_password'),
            'description': 'APP_SECRET 与登录密码仅超级管理员可见，修改后请确认订阅仍可读取。',
        }),
        ('状态', {'fields': ('status', 'update')}),
        ('时间', {'fields': ('create_time', 'update_time'), 'classes': ('collapse',)}),
    )

    @admin.display(description='APP_SECRET')
    def masked_secret(self, obj):
        return mask(obj.password)

    @admin.display(description='实例数')
    def vm_count(self, obj):
        return obj.get_vm_count()


@admin.register(Vm)
class VmAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'account', 'ip', 'status', 'vm_size', 'image',
        'os_disk', 'location', 'create_time',
    )
    list_display_links = ('id', 'name')
    list_filter = ('status', 'location', 'account')
    search_fields = ('name', 'vm_id', 'ip', 'image', 'group')
    autocomplete_fields = ('account',)
    list_select_related = ('account',)
    ordering = ('-id',)
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')

