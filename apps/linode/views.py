from django.http.response import JsonResponse
from django.db.models import Q
from django.views import View

from . import models, tasks

from apps.users.views import Pagination
from libs.utils import DateTimeToStr, dispatch_task, should_auto_sync

from libs.linode import LinodeApi, LinodeCatalog

import json
import re

class LinodeAccountView(View):
    def get(self, request):
        q = Q()
        if request.GET.get('wd'):
            wd = request.GET.get('wd', '').strip()
            q.add(Q(email__icontains=wd)  |  Q(token__icontains=wd)|  Q(name__icontains=wd)|  Q(note__icontains=wd), Q.AND)

        data_list = models.Account.objects.filter(q).order_by('-id')

        limit = request.GET.get('limit', 25)
        page = request.GET.get('page', 1)
        data_count = data_list.count()
        start, end = Pagination(page, limit, data_count)

        _data_list = []
        for data in data_list[start:end]:
            # data.update_instances()
            _data = {
                'id': data.id,
                'name': data.name,
                'euuid': data.euuid,
                'email': data.email,
                'password': data.password,
                'token': data.token,
                'status': data.status,
                'balance': data.balance,
                'count': data.get_vm_count(),
                'note': data.note,
                'active_promotions': data.get_active_promotions(),
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time)
            }
            _data_list.append(_data)
        # 镜像 / 地区 / 规格改为实时拉取官方数据, 拉取失败再回落到模型里的静态表
        _token = models.Account.objects.filter(status=True).order_by('-id').values_list('token', flat=True).first() \
                 or models.Account.objects.order_by('-id').values_list('token', flat=True).first() or ''
        catalog = LinodeCatalog.get(_token, fallback={
            'images': [list(i) for i in models.Vm.images_choices],
            'regions': [list(i) for i in models.Vm.regions_choices],
            'types': [list(i) for i in models.Vm.type_choices],
        })

        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'total': data_count,
                'image_list': catalog['images'],
                'location_list': catalog['regions'],
                'vm_types': catalog['types'],
                'items': _data_list
            }
        })

    def post(self, request):
        account_id = request.POST.get('account_id', '')
        # 去掉空白字符; 兼容从表格整段复制(Token 前后粘了名字)的情况
        raw_token = request.POST.get('token', '')
        token = ''.join(raw_token.split())
        if not re.fullmatch(r'[0-9a-fA-F]{64}', token):
            matched = re.findall(r'[0-9a-fA-F]{64}', raw_token)
            if len(matched) == 1:
                token = matched[0]
        name = request.POST.get('name', '').strip()
        note = request.POST.get('note', '').strip()

        # 编辑: 仅更新名称与备注 (Token 明文展示但不可在此修改, 换 Token 请删除后重新添加)
        if account_id:
            account_info = models.Account.objects.filter(id=account_id).first()
            if not account_info:
                return JsonResponse({'code': 20001, 'message': '账号不存在'})
            account_info.name = name
            account_info.note = note
            account_info.save()
            return JsonResponse({'code': 20000, 'message': '账号已保存'})

        # Linode Token 固定为 64 位十六进制, 提前拦下整段复制/粘贴不全的情况
        if not re.fullmatch(r'[0-9a-fA-F]{64}', token):
            return JsonResponse({
                'code': 20001,
                'message': f'Token 格式不正确: 应为 64 位十六进制字符(当前 {len(token)} 位), 请只粘贴 Token 本身'
            })

        if models.Account.objects.filter(token=token).first():
            return JsonResponse({'code': 20001, 'message': f'该 Token 已存在, 无法重复添加'})

        linodeApi = LinodeApi(token)
        if not linodeApi.get_account():
            # 把官方返回的错误原因(如 Invalid Token / Unauthorized)转成可操作的提示
            reason = ''
            if isinstance(linodeApi.result, dict):
                errors = linodeApi.result.get('errors') or []
                if errors:
                    reason = errors[0].get('reason', '')
            hints = {
                'Invalid Token': 'Token 无效: 请确认未过期、未被撤销, 并且只粘贴了 64 位 Token',
                'Unauthorized': 'Token 权限不足: 需要 Linodes 读写和 Account 读取权限',
            }
            message = hints.get(reason) or (f'无法添加账号: {reason}' if reason else '无效 token, 无法添加')
            return JsonResponse({'code': 20001, 'message': message})
        try:
            result = linodeApi.result
            _data = {
                'token': token,
                'name': name,
                'note': note,
                'email': result.get('email', ''),
                'balance': result.get('balance', ''),
                'euuid': result.get('euuid', ''),
                'active_promotions': json.dumps(result.get('active_promotions') or []),
                'status': True,
            }
            if account_info := models.Account.objects.create(**_data):
                account_info.update_instances()
                return JsonResponse({'code': 20000, 'message': '账号添加成功'})
            return JsonResponse({'code': 20001, 'message': '操作失败'})
        except BaseException as e:
            return JsonResponse({'code': 20001, 'message': f'操作失败: {e}'})

# 删除 Azure 账号
class LinodeAccountDeleteView(View):
    def post(self, request):
        account_id = request.POST.get('account_id')
        account_info = models.Account.objects.filter(id=account_id).first()
        if not account_info:
            return JsonResponse({
                'code': 20001,
                'message': '账号不存在'
            })

        if account_info.delete():
            return JsonResponse({
                'code': 20000,
                'message': '删除成功'
            })
        return JsonResponse({
            'code': 20001,
            'message': '删除失败'
        })

# 刷新 Linode 账号信息 (余额 / 邮箱 / 优惠)
class LinodeAccountUpdateView(View):
    def get(self, request):
        account_id = request.GET.get('account_id')
        account_info = models.Account.objects.filter(id=account_id).first()

        if not account_info:
            return JsonResponse({
                'code': 20001,
                'message': '账号不存在, 无法操作'
            })

        message, status = account_info.get_account()
        if not status:
            return JsonResponse({'code': 20001, 'message': message})
        return JsonResponse({'code': 20000, 'message': message})

# Azure Vm 实例列表
class LinodeVmListView(View):
    def get(self, request):
        q = Q()
        # 按账号筛选 (实例页顶部的账号下拉)
        if request.GET.get('account_id'):
            q.add(Q(account_id=request.GET.get('account_id')), Q.AND)

        # 搜索
        if request.GET.get('wd'):
            wd = request.GET.get('wd', '').strip()
            q.add(Q(instance_id__icontains=wd) | Q(ipv4__icontains=wd)| Q(label__icontains=wd)| Q(password__icontains=wd) , Q.AND)

        if request.GET.get('account_name'):
            wd = request.GET.get('account_name', '').strip()
            q.add(Q(account__name__icontains=wd) | Q(account__email__icontains=wd)| Q(account__token__icontains=wd), Q.AND)

        _data_list = []
        data_list = models.Vm.objects.filter(q).order_by('-create_time', 'id')

        # 存在过渡态实例时自动触发云端状态同步 (30 秒节流, celery 异步执行)
        if any(data.status in ('provisioning', 'booting', 'rebooting') for data in data_list):
            if should_auto_sync('auto_sync_linode'):
                dispatch_task(tasks.beat_update_linode_account)

        limit = request.GET.get('limit', 25)
        page = request.GET.get('page', 1)
        data_count = data_list.count()
        start, end = Pagination(page, limit, data_count)

        for data in data_list[start:end]:
            _data = {
                'id': data.id,
                'name': data.label,
                'ipv4': data.ipv4,
                'ipv6': data.ipv6,
                'instance_id': data.instance_id,
                'password': data.password,
                'type': data.get_type(),
                'image': data.get_image_display(),
                'region': data.get_region_display(),
                'status_text': data.get_status_display(),
                'status': data.status,
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time),
                'account': data.account.email,
                'account_name': data.account.name
            }
            _data_list.append(_data)

        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'total': data_count,
                'items': _data_list
            }
        })

# Linux Vm 操作
class LinodeVmActionView(View):
    def post(self, request):
        vm_id = request.POST.get('vm_id')
        action = request.POST.get('action', '')

        if action in '':
            return JsonResponse({
                'code': 20001,
                'message': '操作无效'
            })

        vm_info = models.Vm.objects.filter(instance_id=vm_id).first()
        if not vm_info:
            return JsonResponse({
                'code': 20001,
                'message': 'VM不存在, 请核实后操作'
            })

        action_map = {
            'boot': '开机',
            'shutdown': '关机',
            'reboot': '重启',
            'delete': '删除',
            'update': '更新',
        }

        if action in ['boot', 'shutdown', 'reboot']:
            # 电源操作
            if vm_info.vm_power_action(action):
                vm_info.account.update_instances()
                return JsonResponse({
                    'code': 20000,
                    'message': f'{vm_info.instance_id} {action_map.get(action, action)} 操作成功, 状态需要更新之后才会显示'
                })
            return JsonResponse({
                'code': 20001,
                'message': '操作失败'
            })

        if action == 'delete':
            status = vm_info.delete_linode()
            return JsonResponse({
                'code': 20000 if status else 20001,
                'message': '实例删除成功' if status else '实例删除失败'
            })

        if action == 'update':
            vm_info.account.update_instances()
            return JsonResponse({
                'code': 20000,
                'message': '更新操作成功'
            })

        if action in ['resetip']:
            return JsonResponse({
                'code': 20001,
                'message': 'Linode 暂不支持更换IP'
            })

# 创建 Linode Vm 实例
class LinodeVmCreateView(View):
    def post(self, request):
        account_id = request.POST.get('account_id')
        password = request.POST.get('password', '')
        image_id = request.POST.get('image_id', '')
        vm_size = request.POST.get('type', '')
        region = request.POST.get('region', '')
        name = request.POST.get('name')
        account_info = models.Account.objects.filter(id=account_id).first()
        if not account_info:
            return JsonResponse({
                'code': 20001,
                'message': '创建失败, 账号不存在!'
            })

        if models.Vm.objects.filter(account_id=account_info.id, label=name).first():
            return JsonResponse({
                'code': 20001,
                'message': '创建失败, 实例名称不可重复!'
            })

        if '' in [region, vm_size, image_id, password]:
            return JsonResponse({
                'code': 20001,
                'message': '创建失败, 异常操作!'
            })
        message, status = account_info.create_vm(region=region, vm_size=vm_size, password=password, name=name, image_id=image_id)
        if status:
            return JsonResponse({
                'code': 20000,
                'message': '创建成功, 请返回实例列表查看!'
            })
        return JsonResponse({
            'code': 20001,
            'message': f'创建失败, {message}!'
        })
