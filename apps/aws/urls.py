"""
aws 路由
"""

from django.urls import path
from apps.aws import views
from apps.users.views import is_token


urlpatterns = [

    # 轻量实例 url
    path('lightsail/instances', is_token(views.GetLightsailInstancesView.as_view()), name="getLightsailInstances"),
    path('lightsail/action', is_token(views.LightsailInstanceActionView.as_view()), name="LightsailInstanceAction"),

    path('lightsail/region', is_token(views.LightsailGetRegionView.as_view()), name="LightsailGetRegionView"),
    path('lightsail/images', is_token(views.LightsailGetImagesView.as_view()), name="LightsailGetImagesView"),
    path('lightsail/create', is_token(views.LightsailCreateInstanceView.as_view()), name="LightsailCreateInstanceView"),

    # EC2 实例
    path('ec2/instances', is_token(views.GetEc2InstancesView.as_view()), name="GetEc2InstancesView"),
    path('ec2/action', is_token(views.Ec2InstanceActionView.as_view()), name="Ec2InstanceActionView"),
    path('ec2/account', is_token(views.Ec2GetAccountView.as_view()), name="Ec2GetAccountView"),
    path('ec2/images', is_token(views.Ec2GetImagesView.as_view()), name="Ec2GetImagesView"),
    path('ec2/region', is_token(views.Ec2GetRegionView.as_view()), name="Ec2GetRegionView"),
    path('ec2/create', is_token(views.Ec2CreateInstanceView.as_view()), name="Ec2CreateInstanceView"),

    # aws 账号
    path('account', is_token(views.AwsAccountView.as_view()), name="AwsAccountView"),
    path('account/delete', is_token(views.AwsAccountDeleteView.as_view()), name="AwsAccountDeleteView"),

    # 获取配额信息
    path('account/get_quota', is_token(views.AwsAccountGetQuotaView.as_view()), name="AwsAccountGetQuotaView"),
    path('account/update', is_token(views.AwsAccountUpdateView.as_view()), name="AwsAccountUpdateView")

]
