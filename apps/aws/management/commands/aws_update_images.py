import os

from django.core.management.base import BaseCommand
from apps.aws.models import Ec2Images


# 官方镜像的 owner 与名称规则: Debian 由 Debian 官方维护, Ubuntu 由 Canonical 维护
EC2_IMAGES_TARGETS = [
    ('Debian 13', '136693071363', 'debian-13-amd64-*'),
    ('Debian 12', '136693071363', 'debian-12-amd64-*'),
    ('Ubuntu 24.04 LTS', '099720109477', 'ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*'),
    ('Ubuntu 22.04 LTS', '099720109477', 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*'),
]


STATIC_IMAGES = [
    ('Debian 13', 'ami-00a4a57f8373eb2e5', 'ap-east-1'),
    ('Debian 12', 'ami-0075a7bdb350e254a', 'ap-east-1'),
    ('Ubuntu 24.04 LTS', 'ami-061fab4c2d0401056', 'ap-east-1'),
    ('Ubuntu 22.04 LTS', 'ami-0848490378b88b932', 'ap-east-1'),
    ('Debian 13', 'ami-0990bacef65633fdf', 'ap-east-2'),
    ('Debian 12', 'ami-082c1bf0083d97dc9', 'ap-east-2'),
    ('Ubuntu 24.04 LTS', 'ami-035615086a1f485e9', 'ap-east-2'),
    ('Ubuntu 22.04 LTS', 'ami-00430e56a3ae78abf', 'ap-east-2'),
    ('Debian 13', 'ami-04c4d7c5f80db97af', 'ap-northeast-1'),
    ('Debian 12', 'ami-0ac06e0f029de7270', 'ap-northeast-1'),
    ('Ubuntu 24.04 LTS', 'ami-04ae19f2563b23082', 'ap-northeast-1'),
    ('Ubuntu 22.04 LTS', 'ami-03873003744ddc492', 'ap-northeast-1'),
    ('Debian 13', 'ami-0c4d503d8e83c3baf', 'ap-northeast-2'),
    ('Debian 12', 'ami-010bc85bdf41ced6a', 'ap-northeast-2'),
    ('Ubuntu 24.04 LTS', 'ami-08d212701172cba2a', 'ap-northeast-2'),
    ('Ubuntu 22.04 LTS', 'ami-068550d7714642b14', 'ap-northeast-2'),
    ('Debian 13', 'ami-0ca99b933239caa2f', 'ap-northeast-3'),
    ('Debian 12', 'ami-046d95e13bb5c407e', 'ap-northeast-3'),
    ('Ubuntu 24.04 LTS', 'ami-07ee67a3ee71e6b12', 'ap-northeast-3'),
    ('Ubuntu 22.04 LTS', 'ami-073f094b1e60bb5cc', 'ap-northeast-3'),
    ('Debian 13', 'ami-0292ebfc59e999fdf', 'ap-south-1'),
    ('Debian 12', 'ami-094b5b539e1023ba3', 'ap-south-1'),
    ('Ubuntu 24.04 LTS', 'ami-089271895175de1ff', 'ap-south-1'),
    ('Ubuntu 22.04 LTS', 'ami-0824445bc4bd4e528', 'ap-south-1'),
    ('Debian 13', 'ami-07a5aa079f90dc641', 'ap-southeast-1'),
    ('Debian 12', 'ami-09391f71eb6701f40', 'ap-southeast-1'),
    ('Ubuntu 24.04 LTS', 'ami-0a6a4c524bc36f8f1', 'ap-southeast-1'),
    ('Ubuntu 22.04 LTS', 'ami-0659642169bf1b4b2', 'ap-southeast-1'),
    ('Debian 13', 'ami-03f509097e69b9b51', 'ap-southeast-2'),
    ('Debian 12', 'ami-019b1ea56fcbc56f7', 'ap-southeast-2'),
    ('Ubuntu 24.04 LTS', 'ami-07e1ec3ae966d34c6', 'ap-southeast-2'),
    ('Ubuntu 22.04 LTS', 'ami-0111f46977d33b84b', 'ap-southeast-2'),
    ('Debian 13', 'ami-0efceefedaf18d384', 'ap-southeast-5'),
    ('Debian 12', 'ami-06fa5cfdc7a56a65e', 'ap-southeast-5'),
    ('Ubuntu 24.04 LTS', 'ami-03346c3b3a13677fa', 'ap-southeast-5'),
    ('Ubuntu 22.04 LTS', 'ami-02b4907e4bd874327', 'ap-southeast-5'),
    ('Debian 13', 'ami-0937f308f7b522a7a', 'ca-central-1'),
    ('Debian 12', 'ami-0b1a09b138bd2446e', 'ca-central-1'),
    ('Ubuntu 24.04 LTS', 'ami-024208b0e77830ebe', 'ca-central-1'),
    ('Ubuntu 22.04 LTS', 'ami-00148f65a52241886', 'ca-central-1'),
    ('Debian 13', 'ami-039500bd90796b9aa', 'eu-central-1'),
    ('Debian 12', 'ami-083a5eed4bc18561c', 'eu-central-1'),
    ('Ubuntu 24.04 LTS', 'ami-0596cf3199908321b', 'eu-central-1'),
    ('Ubuntu 22.04 LTS', 'ami-074dd8e8dac7651a5', 'eu-central-1'),
    ('Debian 13', 'ami-077e795f32a56da75', 'eu-north-1'),
    ('Debian 12', 'ami-0c820880d0f4e2101', 'eu-north-1'),
    ('Ubuntu 24.04 LTS', 'ami-0122da1d0b4a30ec4', 'eu-north-1'),
    ('Ubuntu 22.04 LTS', 'ami-0a4640f53fa171eb4', 'eu-north-1'),
    ('Debian 13', 'ami-025a52ae88f2e370e', 'eu-west-1'),
    ('Debian 12', 'ami-082d899c72222b228', 'eu-west-1'),
    ('Ubuntu 24.04 LTS', 'ami-07dcad2e028cc44c9', 'eu-west-1'),
    ('Ubuntu 22.04 LTS', 'ami-0651fd5b99debb0f4', 'eu-west-1'),
    ('Debian 13', 'ami-036529711fc1e0a41', 'eu-west-2'),
    ('Debian 12', 'ami-0d7e4fc9aca3e1cd2', 'eu-west-2'),
    ('Ubuntu 24.04 LTS', 'ami-0951a43515d1f167b', 'eu-west-2'),
    ('Ubuntu 22.04 LTS', 'ami-052c9005e24cd7236', 'eu-west-2'),
    ('Debian 13', 'ami-017c2f828c09e9470', 'eu-west-3'),
    ('Debian 12', 'ami-073ef04c366723b30', 'eu-west-3'),
    ('Ubuntu 24.04 LTS', 'ami-00a83823b51dbd7a2', 'eu-west-3'),
    ('Ubuntu 22.04 LTS', 'ami-06ad61471e4e8eedc', 'eu-west-3'),
    ('Debian 13', 'ami-0a0164757be44e683', 'sa-east-1'),
    ('Debian 12', 'ami-085fa441189b806d2', 'sa-east-1'),
    ('Ubuntu 24.04 LTS', 'ami-01f4c1893b7b17a94', 'sa-east-1'),
    ('Ubuntu 22.04 LTS', 'ami-03135d413c1dad6be', 'sa-east-1'),
    ('Debian 13', 'ami-0dedb4478c09e1ae7', 'us-east-1'),
    ('Debian 12', 'ami-0f6ac146eef885446', 'us-east-1'),
    ('Ubuntu 24.04 LTS', 'ami-0462ececcfe0a450f', 'us-east-1'),
    ('Ubuntu 22.04 LTS', 'ami-00e1181affe35cfd8', 'us-east-1'),
    ('Debian 13', 'ami-0e80837acd137142b', 'us-east-2'),
    ('Debian 12', 'ami-048d67dc0159823d6', 'us-east-2'),
    ('Ubuntu 24.04 LTS', 'ami-06e3c045d79fd65d9', 'us-east-2'),
    ('Ubuntu 22.04 LTS', 'ami-096a2911074929e0b', 'us-east-2'),
    ('Debian 13', 'ami-08fd0bf44a72751c9', 'us-west-1'),
    ('Debian 12', 'ami-0325248aa1942ab93', 'us-west-1'),
    ('Ubuntu 24.04 LTS', 'ami-06b527a1e4cb6f265', 'us-west-1'),
    ('Ubuntu 22.04 LTS', 'ami-0316a663dce433167', 'us-west-1'),
    ('Debian 13', 'ami-041bdae65d384227b', 'us-west-2'),
    ('Debian 12', 'ami-0863968f8acb422f5', 'us-west-2'),
    ('Ubuntu 24.04 LTS', 'ami-03e8b457f40561815', 'us-west-2'),
    ('Ubuntu 22.04 LTS', 'ami-0640ac12c85f21746', 'us-west-2'),
]


class Command(BaseCommand):
    help = '同步 EC2 AMI 镜像(优先调用官方 describe_images, 失败时写入内置列表)'

    def add_arguments(self, parser):
        parser.add_argument('--region', action='append', default=[], help='只同步指定地区, 可重复传入')
        parser.add_argument('--static', action='store_true', help='跳过官方接口, 直接写入内置列表')

    def handle(self, *args, **options):
        # 注意: handle() 的返回值会被 Django 直接写到 stdout, 这里不能返回 int
        if options.get('static'):
            self.load_static()
            return

        key_id, secret = self.get_credentials()
        if not key_id or not secret:
            self.stdout.write(self.style.WARNING('未找到可用的 AWS 凭证, 使用内置 AMI 列表'))
            self.load_static()
            return

        regions = options.get('region') or self.get_regions(key_id, secret)
        if not regions:
            self.load_static()
            return

        total = 0
        for region in regions:
            total += self.sync_region(key_id, secret, region)

        if total == 0:
            self.stdout.write(self.style.WARNING('官方接口未返回可用镜像, 使用内置 AMI 列表'))
            self.load_static()
            return

        self.stdout.write(self.style.SUCCESS(f'同步完成, 共 {total} 个 AMI'))

    # 凭证来源: 环境变量 > 数据库里的可用账号
    def get_credentials(self):
        key_id = os.getenv('AWS_ACCESS_KEY_ID', '')
        secret = os.getenv('AWS_SECRET_ACCESS_KEY', '')
        if key_id and secret:
            return key_id, secret
        from apps.aws.models import Account
        account = Account.objects.filter(status=True).exclude(key_id='').exclude(secret='').order_by('-id').first()
        if account:
            return account.key_id, account.secret
        return '', ''

    # 地区列表: 官方 describe_regions, 失败时用内置列表里出现过的地区
    def get_regions(self, key_id, secret):
        try:
            from libs.aws import AwsApi
            aApi = AwsApi(key_id, secret)
            aApi.region = 'us-east-1'
            aApi.start('ec2')
            return [r['RegionName'] for r in aApi.client.describe_regions()['Regions']]
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'获取地区列表失败: {e}'))
            return sorted({region for _, _, region in STATIC_IMAGES})

    # 同步单个地区: 每个镜像只保留最新一个 AMI
    def sync_region(self, key_id, secret, region):
        try:
            from libs.aws import AwsApi
            aApi = AwsApi(key_id, secret)
            aApi.region = region
            aApi.start('ec2')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'{region} 初始化失败: {e}'))
            return 0

        _rows = []
        for name, owner, pattern in EC2_IMAGES_TARGETS:
            try:
                ret = aApi.client.describe_images(
                    Owners=[owner],
                    Filters=[
                        {'Name': 'name', 'Values': [pattern]},
                        {'Name': 'state', 'Values': ['available']},
                        {'Name': 'architecture', 'Values': ['x86_64']},
                        {'Name': 'root-device-type', 'Values': ['ebs']},
                        {'Name': 'virtualization-type', 'Values': ['hvm']},
                    ],
                )
                images = sorted(ret.get('Images', []), key=lambda x: x.get('CreationDate', ''), reverse=True)
                if not images:
                    continue
                _rows.append({
                    'name': name,
                    'ami': images[0]['ImageId'],
                    'region': region,
                })
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'{region} {name} 拉取失败: {e}'))
                continue

        if not _rows:
            return 0

        # AMI 会随官方重新发布而变化, 整区覆盖避免旧值残留
        Ec2Images.objects.filter(region=region).delete()
        for row in _rows:
            Ec2Images.objects.update_or_create(ami=row['ami'], defaults={'name': row['name'], 'region': row['region']})
        return len(_rows)

    def load_static(self):
        total = 0
        for name, ami, region in STATIC_IMAGES:
            Ec2Images.objects.update_or_create(
                ami=ami,
                defaults={'name': name, 'region': region},
            )
            total += 1
        self.stdout.write(self.style.SUCCESS(f'Loaded {total} AMI images.'))
        return total
