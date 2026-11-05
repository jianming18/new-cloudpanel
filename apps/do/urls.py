from django.urls import path
from . import views
from apps.users.views import is_token


urlpatterns = [
    # aws 账号
    path('account', is_token(views.DoAccountView.as_view()), name="DoAccountView"),
    path('account/update', is_token(views.DoAccountUpdateView.as_view()), name="DoAccountUpdateView"),
    path('droplets', is_token(views.DoDropletsListView.as_view()), name="DoDropletsListView"),
]
