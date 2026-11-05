from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from apps.users.admin_utils import preview
from apps.users.models import Options, CommonLogs, Scripts


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'id', 'username', 'email', 'is_active', 'is_staff', 'is_superuser',
        'last_login', 'date_joined',
    )
    list_display_links = ('id', 'username')
    list_filter = ('is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email')
    ordering = ('-id',)
    list_per_page = 25
    date_hierarchy = 'date_joined'


@admin.register(Options)
class OptionsAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'value_preview', 'autoload', 'note')
    list_display_links = ('id', 'name')
    list_filter = ('autoload',)
    search_fields = ('name', 'note')
    ordering = ('name',)
    list_per_page = 50

    @admin.display(description='内容')
    def value_preview(self, obj):
        return preview(obj.value, 60)


@admin.register(Scripts)
class ScriptsAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'users', 'content_preview', 'create_time', 'update_time')
    list_display_links = ('id', 'name')
    list_filter = ('users',)
    search_fields = ('name', 'content', 'users__username')
    autocomplete_fields = ('users',)
    list_select_related = ('users',)
    ordering = ('-create_time', '-id')
    list_per_page = 25
    date_hierarchy = 'create_time'
    readonly_fields = ('create_time', 'update_time')

    @admin.display(description='内容预览')
    def content_preview(self, obj):
        return preview(obj.content, 50)


@admin.register(CommonLogs)
class CommonLogsAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'title', 'type', 'ip', 'create_time')
    list_display_links = ('id', 'title')
    list_filter = ('type',)
    search_fields = ('username', 'title', 'content', 'ip')
    ordering = ('-create_time', '-id')
    list_per_page = 50
    date_hierarchy = 'create_time'

