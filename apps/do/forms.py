from django import forms

from apps.aws import models


class AccountForm(forms.Form):
    id = forms.IntegerField(required=False)
    name = forms.CharField(max_length=255)
    email = forms.CharField(max_length=255)
    password = forms.CharField(max_length=255, required=False)
    key = forms.CharField(max_length=255)
    secret = forms.CharField(max_length=255)
    note = forms.CharField(widget=forms.Textarea, required=False)

    def clean_id(self):
        id = self.cleaned_data.get('id', False)
        if not id: return False
        nodeInfo = models.Account.objects.filter(id=id).first()
        if not nodeInfo:
            raise forms.ValidationError(message='账号不存在')
        return nodeInfo


