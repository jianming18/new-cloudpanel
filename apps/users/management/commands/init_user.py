from django.core.management.base import BaseCommand
from apps.users.models import User


class Command(BaseCommand):
    help = '初始化默认管理员 (admin/admin123), 已存在时跳过'

    # 与 install.sh 的 init_admin 保持一致: 默认账号 admin / admin123
    DEFAULT_USERNAME = 'admin'
    DEFAULT_PASSWORD = 'admin123'

    def handle(self, *args, **options):

        if User.objects.filter(username=self.DEFAULT_USERNAME).first():
            self.stdout.write(self.style.SUCCESS('  管理员已经存在'))
            return

        if User.objects.create_superuser(self.DEFAULT_USERNAME, 'admin@admin.com', self.DEFAULT_PASSWORD):
            print("管理员创建成功\n")
            print(f"Username: {self.DEFAULT_USERNAME}\n")
            print(f"Password: {self.DEFAULT_PASSWORD}\n")

        self.stdout.write(self.style.SUCCESS('  初始化/管理员完成'))
