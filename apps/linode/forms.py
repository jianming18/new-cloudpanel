from django import forms

from apps.linode import models


class AccountForm(forms.Form):
    id = forms.IntegerField(required=False)
    name = forms.CharField(max_length=255)
    token = forms.CharField(max_length=255)
    note = forms.CharField(max_length=255, required=False)

    def clean_id(self):
        try:
            id = self.cleaned_data.get('id', False)
            if not id: return False
            nodeInfo = models.Account.objects.filter(id=id).first()
            if not nodeInfo:
                raise forms.ValidationError(message='账号不存在')
            return nodeInfo
        except:
            return False


