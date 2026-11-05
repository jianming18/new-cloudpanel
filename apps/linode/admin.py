from django.contrib import admin

from apps.users.admin_utils import mask

from .models import Account, Vm


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'email', 'masked_token', 'status', 'balance',
        'vm_count', 'note', 'create_time',
    )
    list_display_links = ('id', 'name')
    list_filter = ('status',)
    search_fields = ('name', 'email', 'euuid', 'note')
    ordering = ('-id',)
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')
    fieldsets = (
        ('账号', {'fields': ('name', 'email', 'euuid', 'note')}),
        ('凭证', {
            'fields': ('token', 'password'),
            'description': 'Token 仅超级管理员可见，修改后需要重新同步账号信息。',
        }),
        ('额度与状态', {'fields': ('status', 'balance', 'active_promotions')}),
        ('时间', {'fields': ('create_time', 'update_time'), 'classes': ('collapse',)}),
    )

    @admin.display(description='Token')
    def masked_token(self, obj):
        return mask(obj.token)

    @admin.display(description='实例数')
    def vm_count(self, obj):
        return obj.ld_account.count()


@admin.register(Vm)
class VmAdmin(admin.ModelAdmin):
    list_display = (
        'instance_id', 'label', 'account', 'ipv4', 'type', 'status',
        'region', 'image', 'masked_password', 'create_time',
    )
    list_display_links = ('instance_id', 'label')
    list_filter = ('status', 'type', 'region', 'account')
    search_fields = ('label', 'ipv4', 'ipv6', 'instance_id')
    autocomplete_fields = ('account',)
    list_select_related = ('account',)
    ordering = ('-create_time', '-instance_id')
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')

    @admin.display(description='密码')
    def masked_password(self, obj):
        return mask(obj.password)

