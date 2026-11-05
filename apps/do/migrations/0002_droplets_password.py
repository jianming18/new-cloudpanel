from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('do', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='droplets',
            name='password',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='root密码'),
        ),
    ]
