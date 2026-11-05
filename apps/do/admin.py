from django.contrib import admin

# Register your models here.
from .models import Account, Droplets

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'token', 'status', 'droplet_limit', 'month_to_date_balance', 'note', 'create_time')

@admin.register(Droplets)
class DropletsAdmin(admin.ModelAdmin):
    list_display = ('droplet_id', 'name', 'ip', 'memory', 'vcpus', 'disk', 'status', 'create_time')
