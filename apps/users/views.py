from django.http import JsonResponse
from django.contrib.auth.hashers import check_password
from django.core.cache import cache
from django.db.models import Q
from django.contrib.auth import authenticate, login , logout
import datetime, time
from django.views import View
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt

from libs.utils import DateTimeToStr, Pagination

# 加载 App 资源
from apps.users import models, forms

from libs.utils import md5
# 判断是否登录
def is_token(func):
    def inner(request, *args, **kwargs):
        token = request.META.get('HTTP_X_TOKEN', False)
        if not token:
            return JsonResponse({'code': 50008, 'message': '登录会话失效，请重新的登录'})

        user = cache.get(token, False)
        if not user or not user.is_active or not user.is_superuser:
            return JsonResponse({'code': 50008, 'message': '登录会话失效，请重新的登录'})
        request.user = user
        request.token = token
        return func(request, *args, **kwargs)
    return inner

# 获取首页信息
def Dashboard(request):
    data = {
    }
    return JsonResponse({'code': 20000, 'message': '获取成功', 'data': data })

# 登录
@csrf_exempt
def Login(request):
    if request.method == "POST":
        input_data = forms.Login(request.POST)
        if input_data.is_valid():
            data = input_data.clean()
            user_info = data.get('user_info')
            username = data.get('username')
            password = data.get('password')

            if not user_info.is_active:
                return JsonResponse({'code': 20002, 'message': '该用户禁止登录'})

            user = authenticate(username=username, password=password)

            if not user: return JsonResponse({'code': 20002, 'message': '登录密码错误'})

            token = md5("%s%s" %(user.username, time.time())).upper()
            cache.set(token, user, 172800)
            res_data = {'code': 20000,  'message': '登录成功', 'data': {'token': token}}
            return JsonResponse(res_data)
        return JsonResponse({'code': 20001, 'message': '登录失败', 'error_data': input_data.errors})

# 获取用户信息
@is_token
def Info(request):
    userinfo = User.objects.filter(username=request.user.username).first()
    if not userinfo:
        return JsonResponse({'code': 50008, 'message': '用户信息不存在，请重新登录'})
    data = {
        'avatar': '/logo.png',
        'name': userinfo.username,
        'username': userinfo.username,
        'create_time': userinfo.date_joined.strftime("%Y-%m-%d %H:%M:%S"),
        'roles': ['user']
    }
    if userinfo.is_superuser:
        # 管理员
        data.update({'roles': ['admin'], 'introduction': '.'})

    return JsonResponse({'code': 20000, 'message': '获取成功', 'data': data})

# 退出
def Logout(request):
    cache.set(request.token, '', 0)
    return JsonResponse({'code': 20000, 'data': 'success'})

# 修改密码
@is_token
def ChangePassword(request):
    if request.method != 'POST':
        return JsonResponse({'code': 20001, 'message': '请使用POST请求'})
    input_data = forms.ChangePasswordForm(request.POST)
    if not input_data.is_valid():
        return JsonResponse({'code': 20001, 'message': '参数错误', 'error_data': input_data.errors})
    data = input_data.clean()
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    user = authenticate(username=request.user.username, password=old_password)
    if not user:
        return JsonResponse({'code': 20002, 'message': '旧密码错误'})
    user.set_password(new_password)
    user.save()
    cache.set(request.token, '', 0)
    return JsonResponse({'code': 20000, 'message': '密码修改成功，请重新登录'})

# 获取个人资料
@is_token
def Profile(request):
    userinfo = User.objects.filter(username=request.user.username).first()
    if not userinfo:
        return JsonResponse({'code': 50008, 'message': '用户信息不存在，请重新登录'})
    data = {
        'avatar': '/logo.png',
        'name': userinfo.username,
        'username': userinfo.username,
        'email': userinfo.email,
        'create_time': userinfo.date_joined.strftime("%Y-%m-%d %H:%M:%S"),
        'roles': ['user']
    }
    if userinfo.is_superuser:
        data.update({'roles': ['admin']})
    return JsonResponse({'code': 20000, 'message': '获取成功', 'data': data})

# 获取 用户 基本设置
def getOptions(request):
    options = models.Options.objects.filter(autoload=1)
    dataList = {}
    for option in options:
        if option.value == "False":
            option.value = False
        if option.value == "True":
            option.value = True
        a = {
            option.name: option.value
        }
        dataList.update(a)
    return JsonResponse({'code': 20000, 'data': {'options': dataList}})


# 获取 网站变量 通用函数
def get_options(clean=False):
    if not cache.get('options') or clean:
        # 没有缓存
        options = models.Options.objects.filter(autoload=1).values_list('name', 'value')
        options = dict(options)
        cache.set('options', options, 3600)
        return options
    options = cache.get('options')
    return options


class ScriptsView(View):
    def get(self, request):
        q = Q(users_id=request.user.id)

        data_list = models.Scripts.objects.filter(q).order_by('-create_time', 'id')

        limit = request.GET.get('limit', 25)
        page = request.GET.get('page', 1)
        data_count = data_list.count()
        start, end = Pagination(page, limit, data_count)
        _data_list = []
        for data in data_list[start:end]:
            _data = {
                'id': data.id,
                'name': data.name,
                'content': data.content,
                'create_time': DateTimeToStr(data.create_time),
                'update_time': DateTimeToStr(data.update_time),
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
        script_id = request.POST.get('script_id')
        name = request.POST.get('name', '')
        content = request.POST.get('content', '')

        if '' in [name, content]:
            return hyResponse(20001, '名称和内容不能为空')

        script_info = models.Scripts.objects.filter(id=script_id, users_id=request.user.id).first()

        data = {
            'name': name,
            'content': content,
            'update_time': datetime.datetime.now()
        }

        if not script_info:
            data.update({
                'users_id': request.user.id
            })
            if models.Scripts.objects.create(**data):
                return hyResponse(20000, f'{name} 添加成功')
            return hyResponse(20001, f'{name} 添加失败')

        if models.Scripts.objects.filter(id=script_id, users_id=request.user.id).update(**data):
            return hyResponse(20000, f'{name} 更新成功')
        return hyResponse(20001, f'{name} 添加失败')



# token 获取 用户信息
def getUsers(request):
    token = request.META.get('HTTP_X_TOKEN', False)
    if not token:
        return False
    user = cache.get(token, False)
    return user


# 获取IP地址
def get_ip(request):
    if 'HTTP_X_FORWARDED_FOR' in request.META:
        ip = request.META['HTTP_X_FORWARDED_FOR']
        ip = ip.split(',')[0]
    else:
        ip = request.META['REMOTE_ADDR']
    return ip

#当前时间
def now_time():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

# 公共返回
def hyResponse(code, message, data=None):
    _data = {'code': code, 'message': message, 'title': '操作提示', 'data': data}
    if not data:
        _data.pop('data')
    return JsonResponse(_data)