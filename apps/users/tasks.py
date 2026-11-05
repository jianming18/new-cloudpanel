from __future__ import absolute_import
from celery import shared_task
import time, re, os, requests, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "panelProject.settings")
from . import models
from . import views
import time
import datetime
from django.db.models import Q
from django.db.models import F, FloatField, Sum
from django.core.cache import cache

# 检测两小时未支付的订单, 建议每5分钟一次
@shared_task()
def checkOrder():
    if not hasattr(models, 'Transactions'):
        return True
    ExpiredTime = datetime.datetime.now() - datetime.timedelta(hours=2)
    models.Transactions.objects.filter(status=1, create_time__lt=ExpiredTime).update(status=3)
    # print("未支付账单检测完成")
    return True

if __name__ == '__main__':
    pass
