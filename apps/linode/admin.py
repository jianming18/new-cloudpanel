from django.contrib import admin

# Register your models here.
# Register your models here.
from .models import Account, Vm

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'token', 'status', 'euuid', 'balance', 'note', 'create_time')

@admin.register(Vm)
class VmAdmin(admin.ModelAdmin):
    list_display = ('instance_id', 'label', 'ipv4', 'type', 'status', 'create_time')