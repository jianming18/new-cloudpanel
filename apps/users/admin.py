from django.contrib import admin

# Register your models here.
from apps.users.models import Options, CommonLogs, Scripts

@admin.register(Options)
class OptionsAdmin(admin.ModelAdmin):
    list_display = ('name', 'value', 'autoload', 'note')

@admin.register(Scripts)
class ScriptsAdmin(admin.ModelAdmin):
    list_display = ('id', 'users', 'name', 'create_time')

@admin.register(CommonLogs)
class CommonLogsAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'title', 'content', 'ip', 'create_time')
    search_fields = ['username', 'title', 'content', 'ip']
