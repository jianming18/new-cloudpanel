from django.urls import path
from . import views
from apps.users.views import is_token


urlpatterns = [
    # aws 账号
    path('account', is_token(views.LinodeAccountView.as_view()), name="LinodeAccountView"),
    path('account/delete', is_token(views.LinodeAccountDeleteView.as_view()), name="LinodeAccountDeleteView"),
    path('vm', is_token(views.LinodeVmListView.as_view()), name="LinodeVmListView"),
    path('vm/action', is_token(views.LinodeVmActionView.as_view()), name="LinodeVmActionView"),
    path('vm/create', is_token(views.LinodeVmCreateView.as_view()), name="LinodeVmCreateView"),
]
