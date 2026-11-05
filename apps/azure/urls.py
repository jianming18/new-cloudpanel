from django.urls import path
from . import views
from apps.users.views import is_token

urlpatterns = [
    # aws 账号
    path('account', is_token(views.AzureAccountView.as_view()), name="AzureAccountView"),
    path('account/action', is_token(views.AzureAccountAcitonView.as_view()), name="AzureAccountAcitonView"),
    path('account/delete', is_token(views.AzureAccountDeleteView.as_view()), name="AzureAccountDeleteView"),
    path('vm', is_token(views.AzureVmListView.as_view()), name="AzureVmListView"),
    path('vm/action', is_token(views.AzureVmActionView.as_view()), name="AzureVmActionView"),
    path('vm/create', is_token(views.AzureVmCreateView.as_view()), name="AzureVmCreateView"),
]
