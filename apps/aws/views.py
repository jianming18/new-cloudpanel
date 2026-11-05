from django.http.response import JsonResponse
from django.db.models import Q, Case, When, Value, IntegerField
from django.core.cache import cache
from django.views import View
from django.forms.models import model_to_dict

import json, datetime, logging

logger = logging.getLogger(__name__)

from apps.aws import models, tasks, forms
from apps.users.models import CommonLogs

from libs.utils import DateTimeToStr, Pagination, dispatch_task, should_auto_sync
from libs.aws import lightsail_action, ec2_action, _create_aga, AwsApi, get_regions, get_service_quota, get_ec2_types

class GetLightsailInstancesView(View):
    # 获取轻量实例信息
    def get(self, request):
        q = Q(account__users_id=request.user.id)
        # 按账号筛选 (实例页顶部的账号下拉)
        if request.GET.get('account_id'):
            q.add(Q(account_id=request.GET.get('account_id')), Q.AND)

        # 搜索
        if request.GET.get('wd'):
            wd = request.GET.get('wd', '').strip()
            q.add(Q(name__icontains=wd) | Q(os_name__icontains=wd) | Q(public_ip__icontains=wd) | Q(
                location__icontains=wd), Q.AND)

        if request.GET.get('server_id', False):
            server_id = request.GET.get('server_id')
            q.add(Q(id=server_id), Q.AND)


        if request.GET.get('account_name'):
            wd = request.GET.get('account_name', '').strip()
            q.add(Q(account__name__icontains=wd) | Q(account__email__icontains=wd), Q.AND)


        if request.GET.get('username'):
            wd = request.GET.get('username', '').strip()
            q.add(Q(users__username__icontains=wd), Q.AND)


        _data_list = []
        data_list = models.Lightsail.objects.filter(q).order_by('-create_time', 'id')

        # 存在过渡态实例时自动触发云端状态同步 (30 秒节流, celery 异步执行)
        if any(data.status in ('pending', 'stopping') for data in data_list):
            for account_id in {data.account_id for data in data_list if data.status in ('pending', 'stopping')}:
                if should_auto_sync(f'auto_sync_ls_{account_id}'):
                    dispatch_task(tasks.update_aws, account_id)

        limit = request.GET.get('limit', 25)
        page = request.GET.get('page', 1)
        data_count = data_list.count()
        start, end = Pagination(page, limit, data_count)

        for data in data_list[start:end]:
            _data = {
                'id': data.id,
                'name': data.name,
                'os_name': data.os_id,
                'price': data.price,
                'public_ip': data.public_ip,
                'status': data.status,
                'status_text': data.get_status_display(),
                'region': data.get_region_name(),
                'account': f'{data.account.name}({data.account.value}v)',
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time),
                'expire_time': DateTimeToStr(data.expire_time),
                'password': data.password,
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

class LightsailInstanceActionView(View):
    # 轻量实例操作类
    def post(self, request):
        q = Q(account__users_id=request.user.id)
        action = request.POST.get('action', '')
        server_id = request.POST.get('server_id')
        q.add(Q(id=server_id), Q.AND)
        ret = models.Lightsail.objects.filter(q).first()
        # 判断实例是否存在
        if not ret: return JsonResponse({'code': 20001, 'message': '实例不存在'})


        status, req = lightsail_action(action, ret)
        if action in 'delete': ret.delete()
        if not status: return JsonResponse({'code': 20001, 'message': req})

        if action in 'reset_ip':
            ret_status = ret.reset_ip()
            return JsonResponse({'code': 20000 if ret_status else 20001, 'message': 'IP更换成功' if ret_status else 'IP更换失败'})

        if action not in ['update', 'reset_ip']: return JsonResponse({'code': 20000, 'message': '操作成功'})
        _i = req['instance']
        del _i['hardware']['disks']
        _data = {
            'name': _i['name'],
            'location': json.dumps(_i['location']),
            'hardware': json.dumps(_i['hardware']),
            'os_name': _i['blueprintName'],
            'os_id': _i['blueprintId'],
            'public_ip': _i.get('publicIpAddress', ''),
            'bundle_id': _i['bundleId'],
            'status': _i['state']['name'],
            'private_ip': _i['privateIpAddress'],
            'support_code': _i['supportCode'],
            'create_time': _i['createdAt'].strftime("%Y-%m-%d %H:%M:%S"),
            'update_time': datetime.datetime.now(),
        }
        if models.Lightsail.objects.filter(q).update(**_data): return JsonResponse({'code': 20000, 'message': '操作成功'})
        return JsonResponse({'code': 20001, 'message': '操作失败'})

class LightsailGetRegionView(View):
    # lightsail 对应的 地区列表
    def get(self, request):

        account_id = request.GET.get('account_id', False)
        data_info = models.Account.objects.filter(id=account_id).first()

        if not data_info: return JsonResponse({'code': 20001, 'message': '账号不存在'})

        _data_list = []
        token = 'lightsail_region1'
        try:
            aApi = AwsApi(key_id=data_info.key_id, key_secret=data_info.secret)
            aApi.start('lightsail')
            logger.debug("LightsailGetRegionView cache miss, fetching from API")
            ret = cache.get(token, False)
            if ret in [None, False]:
                ret = aApi.client.get_regions(includeAvailabilityZones=True)
                logger.debug(f"LightsailGetRegionView: fetched regions, count={len(ret.get('regions', []))}")
                cache.set(token, ret, 60 * 60 * 24)
            for region in ret['regions']:
                _data = {
                    'region': region['name'],
                    'name': get_regions(region['name'])
                }
                _data_list.append(_data)
        except Exception as e:
            logger.error(f"LightsailGetRegionView error: {e}")
            return JsonResponse({
                'code': 20001,
                'message': '获取地区列表失败',
                'data': {
                    'items': _data_list
                }
            })

        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'items': _data_list
            }
        })

class LightsailGetImagesView(View):
    # 轻量 对应的 镜像列表和规格
    def get(self, request):
        region = request.GET.get('region', '')
        account_id = request.GET.get('account_id', False)
        account_info = models.Account.objects.filter(id=account_id).first()

        if not account_info: return JsonResponse({'code': 20001, 'message': '账号不存在'})

        aApi = AwsApi(key_id=account_info.key_id, key_secret=account_info.secret)
        aApi.region = region
        aApi.start('lightsail')

        if not aApi.lightsail_get_bundles(): return JsonResponse({'code': 20001, 'message': '获取规格失败'})

        bundles = aApi.bundle

        # 只取当前在售的镜像, 已停用的(旧版 CentOS、即将下线的 Bitnami 等)不再出现在下拉里
        get_blueprints = aApi.client.get_blueprints(
            includeInactive = False
        )
        blueprints = []
        for blueprint in get_blueprints.get('blueprints', []):
            if not blueprint.get('isActive', True): continue
            if blueprint.get('type') == 'app' or blueprint.get('platform') == 'WINDOWS': continue

            name = blueprint.get('blueprintId', '')
            if not name: continue
            if name.startswith('amazon_linux') or name.startswith('free'): continue
            blueprints.append(name)


        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'bundles': bundles,
                'blueprints': blueprints,
            }
        })

class LightsailCreateInstanceView(View):
    # 创建 Lightsail
    def post(self, request):
        password = request.POST.get('password', 'panel778899==')
        name = request.POST.get('name', '')
        images_id = request.POST.get('images_id', False)
        region = request.POST.get('region', False)
        bundle = request.POST.get('bundle', '')

        account_id = request.POST.get('account_id', False)
        account_info = models.Account.objects.filter(id=account_id).first()

        if not account_info: return JsonResponse({'code': 20001, 'message': '账号不存在'})

        user_data = ''
        # if account_info.create_ls(region, name, images_id, bundle, password, user_data):
        #
        #     return JsonResponse({'code': 20000, 'message': '创建成功，请刷新列表后查看'})
        # return JsonResponse({'code': 20001, 'message': '创建实例失败'})

        aApi = AwsApi(key_id=account_info.key_id, key_secret=account_info.secret)
        aApi.region = region
        aApi.start('lightsail')
        aApi.user_data = aApi.user_data.replace('admin77889900==', password)
        if not aApi.create_lightsail_instances(name, bundleId=bundle, blueprintId=images_id):
            return JsonResponse({'code': 20001, 'message': '创建实例失败'})

        _i = aApi.instance
        _data = {
            'users_id': request.user.id,
            'account_id': account_info.id,
            'name': name,
            'password': password,
            'private_ip': _i['privateIpAddress'],
            'bundle_id': _i['bundleId'],
            'location': json.dumps(_i['location']),
            'public_ip': _i.get('publicIpAddress', ''),
            'create_time': _i['createdAt'].strftime("%Y-%m-%d %H:%M:%S"),
            'expire_time': datetime.datetime.now(),
            'update_time': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        models.Lightsail.objects.create(**_data)
        return JsonResponse({'code': 20000, 'message': '创建成功，请刷新列表后查看'})

class GetEc2InstancesView(View):
    # 获取 Ec2 实例信息
    def get(self, request):
        q = Q(account__users_id=request.user.id)
        # 按账号筛选 (实例页顶部的账号下拉)
        if request.GET.get('account_id'):
            q.add(Q(account_id=request.GET.get('account_id')), Q.AND)

        # 搜索
        if request.GET.get('wd'):
            wd = request.GET.get('wd', '').strip()
            q.add(Q(name__icontains=wd) | Q(instance_id__icontains=wd) | Q(public_ip__icontains=wd) | Q(
                region__icontains=wd) | Q(
                image_id=wd) , Q.AND)


        if request.GET.get('account_name'):
            wd = request.GET.get('account_name', '').strip()
            q.add(Q(account__name__icontains=wd) | Q(account__email__icontains=wd), Q.AND)


        if request.GET.get('username'):
            wd = request.GET.get('username', '').strip()
            q.add(Q(users__username__icontains=wd), Q.AND)

        _data_list = []
        data_list = models.Ec2.objects.filter(q).exclude(status='terminated').order_by('-create_time', 'id')

        # 存在过渡态实例时自动触发云端状态同步 (30 秒节流, celery 异步执行)
        if any(data.status in ('pending', 'stopping') for data in data_list):
            for account_id, region in {(data.account_id, data.region) for data in data_list if data.status in ('pending', 'stopping')}:
                if should_auto_sync(f'auto_sync_ec2_{account_id}_{region}'):
                    dispatch_task(tasks.aws_update_ec2, account_id, region)

        limit = request.GET.get('limit', 25)
        page = request.GET.get('page', 1)
        data_count = data_list.count()
        start, end = Pagination(page, limit, data_count)

        for data in data_list[start:end]:
            _data = {
                'id': data.id,
                'name': data.name,
                'instance_id': data.instance_id,
                'price': data.price,
                'public_ip': data.public_ip,
                'status': data.status,
                'instance_type': data.instance_type,
                'is_aga': data.account.aga,
                'image_name': models.Ec2Images.get_images_name(data.image_id),
                'status_text': data.get_status_display(),
                'region': data.get_region_name(),
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time),
                'expire_time': DateTimeToStr(data.expire_time),
                'account': f'{data.account.name}({data.account.value}v)',
                'username': data.get_username(),
                'password': data.password,
            }
            _data_list.append(_data)

        account_data_list = models.Account.objects.filter(status=True, ec2=True).order_by('-id')
        _account_data_list = []
        for data in account_data_list:
            _data = {
                'id': data.id,
                'name': f'{data.name}({data.get_ec2_count()}/{data.value}v)'
            }
            _account_data_list.append(_data)

        # 机型清单实时取自官方 describe_instance_types, 无可用账号时回落到内置清单
        _catalog_account = account_data_list.first()
        ec2_types = get_ec2_types(
            _catalog_account.key_id if _catalog_account else '',
            _catalog_account.secret if _catalog_account else '',
        )

        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'total': data_count,
                'account_list': _account_data_list,
                'items': _data_list,
                'ec2_types': ec2_types,
                'username': request.user.username
            }
        })

class Ec2InstanceActionView(View):
    # Ec2实例操作类
    def post(self, request):
        try:
            # q = request.user_q
            q = Q(account__users_id=request.user.id)
            action = request.POST.get('action', '')
            server_id = request.POST.get('server_id')
            q.add(Q(id=server_id), Q.AND)
            ret = models.Ec2.objects.filter(q).first()
            # 判断实例是否存在
            if not ret: return JsonResponse({'code': 20001, 'message': 'Ec2实例不存在'})

            # 操作 aga
            if action == 'create_aga':
                ret_aga = _create_aga(ret)
                if ret_aga:
                    ip = []
                    try:
                        _data = {
                            'account_id': ret.account.id,
                            'instance_id': ret.id,
                            'arn': ret_aga['AcceleratorArn'],
                            'name': ret_aga['Name'],
                            'note': ret.name,
                            'dns_name': ret_aga['DnsName'],
                            'status': ret_aga['Status'],
                            'enabled': ret_aga['Enabled'],
                            'ip_address': ','.join(ret_aga['IpSets'][0]['IpAddresses']),
                            'create_time': datetime.datetime.now(),
                            'update_time': datetime.datetime.now()
                        }
                        models.GlobalAccelerator.objects.create(**_data)
                        ip = ret_aga['IpSets'][0]['IpAddresses']
                    except Exception as e:
                        logger.error(f"Ec2InstanceActionView create_aga error: {e}")
                    return JsonResponse({'code': 20000, 'message': '创建成功, 等待几分钟到全球加速器列表查看！', 'ip': ip})

                return JsonResponse({'code': 20001, 'message': '创建失败, 请联系管理员！'})

            status, req = ec2_action(action, ret)
            if not status: return JsonResponse({'code': 20001, 'message': req})

            if action not in ['update', 'reset_ip']:
                # .update_ec2.delay(ret.region)
                tasks.aws_update_ec2.delay(ret.account.id, ret.region)
                return JsonResponse({'code': 20000, 'message': '操作成功'})
            _instance = req
            _data = {
                # 'name': name,
                'image_id': _instance['ImageId'],
                'instance_id': _instance['InstanceId'],
                'instance_type': _instance['InstanceType'],
                'create_time': (_instance['LaunchTime'] + datetime.timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"),
                'status': _instance['State']['Name'],
                'public_ip': _instance.get('PublicIpAddress', ''),
                'private_ip': _instance.get('PrivateIpAddress', ''),
                'update_time': datetime.datetime.now()
            }

            for _tag in _instance.get('Tags', []):
                if _tag.get('Key', '') not in 'Name': continue
                name = _tag.get('Value', '-')
                _data.update({'name': name})

            if models.Ec2.objects.filter(q).update(**_data): return JsonResponse({'code': 20000, 'message': '操作成功'})
            return JsonResponse({'code': 20001, 'message': '操作失败'})
        except Exception as e:
            logger.error(f"Ec2InstanceActionView error: {e}")
            return JsonResponse({'code': 20001, 'message': '操作失败', 'error': str(e)})

class Ec2GetAccountView(View):
    # EC2
    def get(self, request):
        data_list = models.Account.objects.filter(status=True,).order_by('-id')
        _data_list = []
        for data in data_list:
            _data = {
                'id': data.id,
                'name': f'{data.name}({data.value}v)',
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time)
            }
            _data_list.append(_data)
        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'items': _data_list
            }
        })

class Ec2GetRegionView(View):
    # EC2 对应的 地区列表
    def get(self, request):

        account_id = request.GET.get('account_id', False)
        data_info = models.Account.objects.filter(id=account_id).first()

        if not data_info: return JsonResponse({'code': 20001, 'message': '账号不存在'})

        _data_list = []

        token = f'{data_info.id}-regions'

        try:
            regions = cache.get(token, False)
            if not regions:
                aApi = AwsApi(key_id=data_info.key_id, key_secret=data_info.secret)
                aApi.start('ec2')
                ret = aApi.client.describe_regions(AllRegions=False)
                regions = ret['Regions']
                cache.set(token, regions, 60 * 10)

            for region in regions:
                _data = {
                    'region': region['RegionName'],
                    'name': get_regions(region['RegionName'])
                }
                _data_list.append(_data)
        except Exception as e:
            logger.error(f"Ec2GetRegionView error: {e}")
            return JsonResponse({
                'code': 20001,
                'message': '获取地区列表失败',
                'data': {
                    'items': _data_list
                }
            })

        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'items': _data_list
            }
        })

from django.db.models import Case, When, Value, IntegerField

class Ec2GetImagesView(View):
    def get(self, request):
        region = request.GET.get('region', '')
        data_list = models.Ec2Images.objects.filter(region=region).annotate(
            sort_order=Case(
                When(name='Debian 13', then=Value(1)),
                When(name='Debian 12', then=Value(2)),
                When(name='Ubuntu 24.04 LTS', then=Value(3)),
                When(name='Ubuntu 22.04 LTS', then=Value(4)),
                default=Value(99),
                output_field=IntegerField(),
            )
        ).order_by('sort_order', 'name')
        _data_list = []
        for data in data_list:
            _data = {
                'id': data.id,
                'name': data.name,
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time)
            }
            _data_list.append(_data)
        return JsonResponse({
            'code': 20000,
            'message': '获取成功',
            'data': {
                'items': _data_list
            }
        })

class Ec2CreateInstanceView(View):
    # 创建 EC2
    def post(self, request):
        inputData = forms.AddEc2Form(request.POST)
        if inputData.is_valid():

            data = inputData.clean()
            account_info = data.get('account_id')

            InstanceType = data.get('ec2_type', '')
            name = data.get('name', '')
            password = data.get('password', '')
            ec2_disk = data.get('ec2_disk', 10)
            ec2_count = data.get('ec2_count', 1)
            region = data.get('region')
            images_info = data.get('images_id')
            script_info = data.get('script_id', False)

            if InstanceType == '':
                InstanceType = 't2.micro'
                if region in ['ap-east-1', 'eu-north-1', 'af-south-1', 'eu-south-1', 'me-south-1']: InstanceType = 't3.micro'

            DeviceName = 'sda1' if 'Debian' not in images_info.name else 'xvda'

            # AMI 是地区级资源, 跨区使用会直接报 InvalidAMIID.NotFound
            if images_info.region != region:
                return JsonResponse({
                    'code': 20001,
                    'message': f'所选镜像属于 {images_info.region} 地区, 与目标地区 {region} 不一致, 请重新选择镜像'
                })

            if script_info:
                user_data = script_info.content
            else:
                user_data = ''

            status, result = account_info.create_ec2(region, InstanceType, name, ec2_disk, DeviceName, ec2_count, password, user_data, images_info.ami)
            if status:
                tasks.aws_update_ec2(account_info.id, region)
                return JsonResponse({'code': 20000, 'message': '创建成功'})
            return JsonResponse({'code': 20001, 'message': result})
        return JsonResponse({'code': 20001, 'message': '操作失败', 'error_data': inputData.errors})


class AwsAccountView(View):
    def get(self, request):
        q = Q()

        if request.GET.get('account_name'):
            wd = request.GET.get('account_name', '').strip()
            q.add(Q(name__icontains=wd) | Q(email__icontains=wd), Q.AND)

        if request.GET.get('username'):
            wd = request.GET.get('username', '').strip()
            q.add(Q(users__username__icontains=wd), Q.AND)

        if request.GET.get('status'):
            wd = request.GET.get('status')
            q.add(Q(status=wd), Q.AND)

        if request.GET.get('value'):
            value = request.GET.get('value')
            q.add(Q(value=value), Q.AND)

        if request.GET.get('wd'):
            wd = request.GET.get('wd', '').strip()
            q.add(Q(name__icontains=wd) | Q(email__icontains=wd) |  Q(card__icontains=wd), Q.AND)

        data_list = models.Account.objects.filter(q).order_by('-id')

        limit = request.GET.get('limit', 25)
        page = request.GET.get('page', 1)
        data_count = data_list.count()
        start, end = Pagination(page, limit, data_count)

        _data_list = []
        for data in data_list[start:end]:
            _secret = data.secret
            masked_secret = _secret[:4] + '****' + _secret[-4:] if _secret and len(_secret) > 8 else '****'
            _data = {
                'id': data.id,
                'name': data.name,
                'email': data.email,
                'password': '****',
                'key_id': data.key_id,
                'secret': masked_secret,
                'status': data.status,
                'value': f'{data.get_ec2_count()} / {data.value}' ,
                'note': data.note,
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time)
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

    def post(self, request):
        inputData = forms.AccountForm(request.POST)
        if inputData.is_valid():
            data = inputData.clean()
            dataInfo = data.get('id', False)
            email = data.get('email', '')
            _data = {
                'name': data.get('name', ''),
                'email': data.get('email', ''),
                'password': data.get('password', ''),
                'key_id': data.get('key'),
                'note': data.get('note', ''),
                'auto_boot': data.get('auto_boot', False),
                'users_id': request.user.id,
                'secret': data.get('secret')
            }
            # 编辑时前端不一定会回填备注(列表接口不返回), 未提交就保留原值, 避免被清空
            if dataInfo and 'note' not in request.POST:
                _data.pop('note', None)
            if not dataInfo:

                # 添加账号
                if models.Account.objects.filter(key_id=data.get('key'), secret=data.get('secret')).first():
                    return JsonResponse({'code': 20001, 'message': f'账号添加失败, 该KEY已存在。'})

                # 检测异常账号数量
                error_count = models.Account.objects.filter(users_id=request.user.id, value=0, status=False).count()
                if error_count >=3 and not request.user.is_superuser:
                    return JsonResponse({'code': 20001, 'message': f'添加失败, 防止资源浪费, 请及时删除异常账户, 当前异常账户 {error_count} 个'})

                # 测试账号是否正常
                value = get_service_quota(data.get('key'), data.get('secret'))
                if type(value) == bool:
                    return JsonResponse({'code': 20001, 'message': f'账号添加失败, 只能添加有效的账号'})

                _data.update({
                    # 'status': 1,
                    'ec2': 1,
                    'aga': 1,
                    'ip': data.get('ip', ''),
                    'card': data.get('card', ''),
                    'value': value
                })

                ret = models.Account.objects.create(**_data)
                if ret:
                    tasks.update_aws.delay(ret.id)
                    return JsonResponse({'code': 20000, 'message': f'{email} 账号添加成功', 'data': {'id': ret.id}})
                return JsonResponse({'code': 20002, 'message': f'{email} 账号添加失败'})
            if models.Account.objects.filter(id=dataInfo.id).update(**_data):
                return JsonResponse({'code': 20000, 'message': f'{email} 账号添加成功'})

            return JsonResponse({'code': 20000, 'message': f'账号更新失败'})
        return JsonResponse({'code': 20001, 'message': '操作失败', 'error_data': inputData.errors})

# 删除账号
class AwsAccountDeleteView(View):
    def post(self, request):
        account_id = request.POST.get('account_id')
        account_info = models.Account.objects.filter(id=account_id)
        if not account_info.first():
            return JsonResponse({
                'code': 20001,
                'message': '账号不存在, 无法操作'
            })
        email = account_info.first().email

        if account_info.delete():
            return JsonResponse({
                'code': 20000,
                'message': f'{email} 删除成功'
            })
        return JsonResponse({
            'code': 20000,
            'message': f'{email} 删除失败'
        })

class AwsAccountGetQuotaView(View):

    def get(self, request):
        account_id = request.GET.get('account_id')

        account_info = models.Account.objects.filter(id=account_id).first()
        if not account_info:
            return JsonResponse({
                'code': 20001,
                'message': f'账号不存在',
            })
        ret = account_info._get_service_quota()
        return JsonResponse({
            'code': 20000,
            'message': f'操作完成',
            'data': {
                'items': ret
            }
        })

# aws 更新实例
class AwsAccountUpdateView(View):

    def get(self, request):
        account_id = request.GET.get('account_id')
        account_info = models.Account.objects.filter(id=account_id).first()
        if not account_info:
            return JsonResponse({
                'code': 20001,
                'message': f'账号不存在',
            })
        tasks.update_aws(account_info.id)
        return JsonResponse({
            'code': 20000,
            'message': f'已提交至后台操作'
        })
