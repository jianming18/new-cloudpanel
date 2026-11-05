from django.db import models
from django.contrib.auth.models import User

# 网站设置
class Options(models.Model):
    name = models.CharField('变量名称', max_length=100)
    value = models.TextField('内容', default='', null=True, blank=True)
    autoload = models.BooleanField('自动加载', default=1)
    note = models.CharField('备注', max_length=200, default='', blank=True)

    class Meta:
        db_table = 'hy_options'
        verbose_name = '网站设置'
        verbose_name_plural = verbose_name


# 公共日志
class CommonLogs(models.Model):
    username = models.CharField('用户名', max_length=100, default='system')
    title = models.CharField('日志标题', max_length=200, default='', db_index=True)
    type_choices = (
        (1, '其他'),
        (2, '阿里云'),
    )
    type = models.PositiveSmallIntegerField('日志类型', choices=type_choices, default=1)
    content = models.TextField('日志内容',default='')
    ip = models.GenericIPAddressField('操作IP', default='', db_index=True)
    create_time = models.DateTimeField('添加时间', null=True, auto_now_add=True)

    class Meta:
        verbose_name = "公共日志"
        verbose_name_plural = verbose_name

    @classmethod
    def create_logs(cls, title, content, type=1, username='system', ip='127.0.0.1'):
        cls.objects.create(title=title, content=content, type=type, username=username, ip=ip)
        return True


# 开机脚本
class Scripts(models.Model):
    users = models.ForeignKey(User, verbose_name='脚本', on_delete=models.SET_NULL, null=True, default=None)
    name = models.CharField('脚本名称', max_length=200, default='')
    content = models.TextField('脚本内容', default='', blank=True)

    create_time = models.DateTimeField('创建时间', auto_now_add=True, null=True)
    update_time = models.DateTimeField('更新时间', auto_now=True, null=True)

    class Meta:
        verbose_name = "脚本管理"
        verbose_name_plural = verbose_name
