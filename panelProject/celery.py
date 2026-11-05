from __future__ import absolute_import
from __future__ import unicode_literals
import os
from celery import Celery
from django.utils import timezone
from kombu import Exchange
from kombu import Queue
import datetime
from celery.schedules import crontab

from dotenv import load_dotenv

load_dotenv()

# set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'panelProject.settings')
os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')
REDIS = os.getenv("REDIS") or f"{os.getenv('REDIS_HOST', 'redis')}:{os.getenv('REDIS_PORT', '6379')}"
REDIS_URL = REDIS if REDIS.startswith('redis://') else f'redis://{REDIS}/1'
app = Celery("app", backend=REDIS_URL, broker=REDIS_URL)

# app.now=datetime.datetime.utcnow
# print app.now(), 'celery---------------->>>>>>'

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
# 在django配置文件中进行配置,以大写CELERY开头
app.config_from_object('django.conf:settings', namespace='celery')
# 解决时区问题,定时任务启动就循环输出
#app.now = timezone.now
app.now = datetime.datetime.now

# Load task modules from all registered Django app configs.
# celery自动发现所有django-app下面的任务tasks.py
app.autodiscover_tasks()

# 通过设置x-max-priority参数来配置队列以支持优先级
# app.conf.task_queues = [
#     Queue('tasks', Exchange('tasks'), routing_key='tasks',
#           queue_arguments={'x-max-priority': 10}),
# ]
# 设置所有队列的默认值
app.conf.task_queue_max_priority = 10
CELERYD_MAX_TASKS_PER_CHILD = 5
# 设置了三个Queue绑定到一个direct类型的exchange上,然后consumer监听所有的队列,消息来了后就轮询调用consumer进行处理.
task_exchange = Exchange('tasks', type='direct')
# 异步任务优先级
task_queues = [Queue('hipri', task_exchange, routing_key='hipri'),
               Queue('midpri', task_exchange, routing_key='midpri'),
               Queue('lopri', task_exchange, routing_key='lopri')]

app.conf.beat_schedule = {

    # 每分钟检测一次 异常实例
    'checkAwsEc2Status': {
        'task': 'apps.aws.tasks.beat_check_ec2',
        'schedule': crontab(minute='*'),
        'args': ()
    },
    # 每小时检测一次账号配额
    'beat_update_value': {
        'task': 'apps.aws.tasks.beat_update_value',
        'schedule': crontab(minute='00', hour='*'),
        'args': ()
    },
    # 每天定时更新一次全部账号
    'update_all_account': {
        'task': 'apps.aws.tasks.update_all_account',
        'schedule': crontab(minute='11', hour='00'),
        'args': ()
    },
    # 每天定时更新一次azure全部账号
    'beat_update_azure_account': {
        'task': 'apps.azure.tasks.beat_update_azure_account',
        'schedule': crontab(minute='30', hour='*/4'),
        'args': ()
    },

    # 每4小时更新一次linode账号 beat_update_linode_account
    'beat_update_linode_account': {
        'task': 'apps.linode.tasks.beat_update_linode_account',
        'schedule': crontab(minute='40', hour='*/4'),
        'args': ()
    },

    # 每4小时更新一次do账号 beat_update_linode_account
    'beat_update_do_account': {
        'task': 'apps.do.tasks.beat_update_do_account',
        'schedule': crontab(minute='50', hour='*/4'),
        'args': ()
    },
}
#beat_update_azure_account
