"""
用户模块 路由
"""

from django.urls import path
from apps.users import views

urlpatterns = [

    # 登录注册
    path('login', views.Login, name="UsersLogin"),
    path('logout', views.is_token(views.Logout), name="UsersLogout"),

    # 获取用户信息
    path('info', views.is_token(views.Info), name="UsersInfo"),

    # 个人资料
    path('profile', views.is_token(views.Profile), name="UsersProfile"),

    # 修改密码
    path('change_password', views.is_token(views.ChangePassword), name="UsersChangePassword"),

    # 基本设置
    path('get/options', views.is_token(views.getOptions), name="getOptions"),

    path('scripts', views.is_token(views.ScriptsView.as_view()), name='ScriptsView'),

]
