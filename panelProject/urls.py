"""panelProject URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.db import connection

admin.site.site_header = 'CloudPanel 管理后台'
admin.site.site_title = 'CloudPanel'
admin.site.index_title = ''
from django.db.utils import DatabaseError
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import path, include


def health(request):
    try:
        connection.ensure_connection()
    except DatabaseError:
        return JsonResponse({'status': 'error', 'message': 'database unavailable'}, status=503)
    return JsonResponse({'status': 'ok'})


def index(request):
    return redirect('/api/admin/')

urlpatterns = [
    path('', index),
    path('health/', health),

    # 后台
    path('api/admin/', admin.site.urls),

    # 正式版 url
    path('api/aws/', include('apps.aws.urls')),
    path('api/azure/', include('apps.azure.urls')),
    path('api/passport/', include('apps.users.urls')),
    path('api/linode/', include('apps.linode.urls')),
    path('api/do/', include('apps.do.urls')),
    path('api/users/', include('apps.users.urls'))
]
