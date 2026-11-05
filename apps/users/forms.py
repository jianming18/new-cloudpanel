from django import forms
from apps.users import models

from django.contrib.auth.models import User, make_password
from django.contrib.auth import authenticate

# 登录
class Login(forms.Form):
    username = forms.CharField(max_length=32, min_length=3, error_messages={'required': '账号不能为空', 'max_length': '账号最大长度为32位', 'min_length': '账号最小长度为4位'})
    password = forms.CharField(max_length=32, min_length=3, error_messages={'required': '密码不能为空', 'max_length': '密码最大长度为32位', 'min_length': '密码最小长度为4位'})
    code = forms.CharField(required=False, max_length=4, error_messages={'required': '验证码错误', 'max_length': '验证码错误'})

    # 判断账号是否存在
    def clean_username(self):
        try:
            username = self.cleaned_data.get('username').strip().lower()
            user_info = User.objects.filter(username=username).first()
            if not user_info:
                raise forms.ValidationError(message='该 %s 用户不存在' % username)
            self.cleaned_data.update({
                'user_info': user_info
            })
            return username
        except BaseException as e:
            raise forms.ValidationError(message='登录失败: %s' % e)

    # 处理密码
    def clean_password(self):
        password = self.cleaned_data.get('password').strip()
        return password

# 修改密码
class ChangePasswordForm(forms.Form):
    old_password = forms.CharField(max_length=32, min_length=3, error_messages={'required': '旧密码不能为空'})
    new_password = forms.CharField(max_length=32, min_length=3, error_messages={'required': '新密码不能为空', 'min_length': '密码最小长度为4位'})
    confirm_password = forms.CharField(max_length=32, min_length=3, error_messages={'required': '确认密码不能为空'})

    def clean(self):
        cleaned_data = super().clean()
        new_password = cleaned_data.get('new_password')
        confirm_password = cleaned_data.get('confirm_password')
        if new_password and confirm_password and new_password != confirm_password:
            raise forms.ValidationError({'confirm_password': '两次输入的密码不一致'})
        return cleaned_data

# 网站设置
class Options(forms.Form):
    pay_appid = forms.IntegerField(required=False)
    pay_private_key = forms.CharField(required=False, widget=forms.Textarea)
    pay_public_key = forms.CharField(required=False, widget=forms.Textarea)
    pay_notice_url = forms.URLField(required=False)
    smtp_host = forms.CharField(required=False)
    smtp_port = forms.CharField(required=False)
    smtp_username = forms.CharField(required=False)
    smtp_password = forms.CharField(required=False)
    stmp_email = forms.CharField(required=False)
    stmp_name = forms.CharField(required=False)
    stmp_ssl = forms.BooleanField(required=False)


class createOrder(forms.Form):
    money = forms.DecimalField(min_value=0, max_value=9999)


# 判断是否为中文
def is_contains_chinese(strs):
    for _char in strs:
        if '\u4e00' <= _char <= '\u9fa5':
            return True
    return False
