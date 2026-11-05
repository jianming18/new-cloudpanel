from django import forms

from apps.aws import models
from apps.users.models import Scripts

class AccountForm(forms.Form):
    id = forms.IntegerField(required=False)
    name = forms.CharField(max_length=255)
    email = forms.CharField(max_length=255)
    password = forms.CharField(max_length=255, required=False)
    key = forms.CharField(max_length=255)
    ip = forms.CharField(max_length=255, required=False)
    auto_boot = forms.BooleanField(required=False)
    card = forms.CharField(max_length=255, required=False)
    secret = forms.CharField(max_length=255)
    note = forms.CharField(widget=forms.Textarea, required=False)

    def clean_id(self):
        id = self.cleaned_data.get('id', False)
        if not id: return False
        nodeInfo = models.Account.objects.filter(id=id).first()
        if not nodeInfo:
            raise forms.ValidationError(message='账号不存在')
        return nodeInfo

class AddEc2Form(forms.Form):
    account_id = forms.IntegerField()
    images_id = forms.IntegerField()
    ec2_disk = forms.IntegerField()
    ec2_count = forms.IntegerField()
    script_id = forms.IntegerField(required=False)
    password = forms.CharField(max_length=255)
    name = forms.CharField(max_length=255, required=False)
    region = forms.CharField(max_length=255)
    ec2_type = forms.CharField(max_length=255, required=False)

    # 账号信息
    def clean_account_id(self):
        account_id = self.cleaned_data.get('account_id', False)

        data_info = models.Account.objects.filter(id=account_id).first()
        if not data_info:
            raise forms.ValidationError(message='账号不存在')
        return data_info


    def clean_ec2_type(self):
        ec2_type = self.cleaned_data.get('ec2_type', '')
        if ec2_type in '': return ''
        return ec2_type.strip().split()[0]

    def clean_images_id(self):

        data_id = self.cleaned_data.get('images_id', False)
        data_info = models.Ec2Images.objects.filter(id=data_id).first()
        if not data_info:
            raise forms.ValidationError(message='所选镜像ID不存在')
        return data_info

    def clean_script_id(self):

        data_id = self.cleaned_data.get('script_id', False)
        if not data_id: return False
        data_info = Scripts.objects.filter(id=data_id).first()
        if not data_info:
            raise forms.ValidationError(message='所选脚本不存在')
        return data_info