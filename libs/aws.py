import boto3
import base64
import json, datetime, time, random
import os

USER_DATA = R"""#!/bin/sh
sudo sed -i.bak '/^SELINUX=/cSELINUX=disabled' /etc/sysconfig/selinux;
sudo sed -i.bak '/^SELINUX=/cSELINUX=disabled' /etc/selinux/config;
sudo setenforce 0;
echo root:'admin77889900==' |sudo chpasswd root
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/g' /etc/ssh/sshd_config;
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/g' /etc/ssh/sshd_config;
sudo service sshd restart;
"""


"""
sudo service iptables stop 2> /dev/null ; chkconfig iptables off 2> /dev/null ;
#sudo systemctl stop firewalld.service 2> /dev/null ; systemctl disable firewalld.service 2> /dev/null ;

sudo dd if=/dev/zero of=/var/swap bs=1024 count=2048000;
sudo echo -e "*       soft    nofile  102400 \n*       hard    nofile  102400\n*       soft    nproc  102400\n*       hard    nproc  102400" >> /etc/security/limits.conf;
sudo ulimit -n 102400;
sudo mkswap /var/swap;
sudo /sbin/swapon /var/swap;
sudo echo "/var/swap swap swap default 0 0" >> /etc/fstab;
"""


EC2_TYPES = ['c1.medium (2vCPUs, 1.69921875GB RAM)', 'c1.xlarge (8vCPUs, 7.0GB RAM)', 'c3.2xlarge (8vCPUs, 15.0GB RAM)', 'c3.4xlarge (16vCPUs, 30.0GB RAM)', 'c3.8xlarge (32vCPUs, 60.0GB RAM)', 'c3.large (2vCPUs, 3.75GB RAM)', 'c3.xlarge (4vCPUs, 7.5GB RAM)', 'c4.2xlarge (8vCPUs, 15.0GB RAM)', 'c4.4xlarge (16vCPUs, 30.0GB RAM)', 'c4.8xlarge (36vCPUs, 60.0GB RAM)', 'c4.large (2vCPUs, 3.75GB RAM)', 'c4.xlarge (4vCPUs, 7.5GB RAM)', 'c5.12xlarge (48vCPUs, 96.0GB RAM)', 'c5.18xlarge (72vCPUs, 144.0GB RAM)', 'c5.24xlarge (96vCPUs, 192.0GB RAM)', 'c5.2xlarge (8vCPUs, 16.0GB RAM)', 'c5.4xlarge (16vCPUs, 32.0GB RAM)', 'c5.9xlarge (36vCPUs, 72.0GB RAM)', 'c5.large (2vCPUs, 4.0GB RAM)', 'c5.metal (96vCPUs, 192.0GB RAM)', 'c5.xlarge (4vCPUs, 8.0GB RAM)', 'c5a.12xlarge (48vCPUs, 96.0GB RAM)', 'c5a.16xlarge (64vCPUs, 128.0GB RAM)', 'c5a.24xlarge (96vCPUs, 192.0GB RAM)', 'c5a.2xlarge (8vCPUs, 16.0GB RAM)', 'c5a.4xlarge (16vCPUs, 32.0GB RAM)', 'c5a.8xlarge (32vCPUs, 64.0GB RAM)', 'c5a.large (2vCPUs, 4.0GB RAM)', 'c5a.xlarge (4vCPUs, 8.0GB RAM)', 'c5ad.12xlarge (48vCPUs, 96.0GB RAM)', 'c5ad.16xlarge (64vCPUs, 128.0GB RAM)', 'c5ad.24xlarge (96vCPUs, 192.0GB RAM)', 'c5ad.2xlarge (8vCPUs, 16.0GB RAM)', 'c5ad.4xlarge (16vCPUs, 32.0GB RAM)', 'c5ad.8xlarge (32vCPUs, 64.0GB RAM)', 'c5ad.large (2vCPUs, 4.0GB RAM)', 'c5ad.xlarge (4vCPUs, 8.0GB RAM)', 'c5d.12xlarge (48vCPUs, 96.0GB RAM)', 'c5d.18xlarge (72vCPUs, 144.0GB RAM)', 'c5d.24xlarge (96vCPUs, 192.0GB RAM)', 'c5d.2xlarge (8vCPUs, 16.0GB RAM)', 'c5d.4xlarge (16vCPUs, 32.0GB RAM)', 'c5d.9xlarge (36vCPUs, 72.0GB RAM)', 'c5d.large (2vCPUs, 4.0GB RAM)', 'c5d.metal (96vCPUs, 192.0GB RAM)', 'c5d.xlarge (4vCPUs, 8.0GB RAM)', 'c5n.18xlarge (72vCPUs, 192.0GB RAM)', 'c5n.2xlarge (8vCPUs, 21.0GB RAM)', 'c5n.4xlarge (16vCPUs, 42.0GB RAM)', 'c5n.9xlarge (36vCPUs, 96.0GB RAM)', 'c5n.large (2vCPUs, 5.25GB RAM)', 'c5n.metal (72vCPUs, 192.0GB RAM)', 'c5n.xlarge (4vCPUs, 10.5GB RAM)', 'cc2.8xlarge (32vCPUs, 60.5GB RAM)', 'd2.2xlarge (8vCPUs, 61.0GB RAM)', 'd2.4xlarge (16vCPUs, 122.0GB RAM)', 'd2.8xlarge (36vCPUs, 244.0GB RAM)', 'd2.xlarge (4vCPUs, 30.5GB RAM)', 'd3.2xlarge (8vCPUs, 64.0GB RAM)', 'd3.4xlarge (16vCPUs, 128.0GB RAM)', 'd3.8xlarge (32vCPUs, 256.0GB RAM)', 'd3.xlarge (4vCPUs, 32.0GB RAM)', 'd3en.12xlarge (48vCPUs, 192.0GB RAM)', 'd3en.2xlarge (8vCPUs, 32.0GB RAM)', 'd3en.4xlarge (16vCPUs, 64.0GB RAM)', 'd3en.6xlarge (24vCPUs, 96.0GB RAM)', 'd3en.8xlarge (32vCPUs, 128.0GB RAM)', 'd3en.xlarge (4vCPUs, 16.0GB RAM)', 'f1.16xlarge (64vCPUs, 976.0GB RAM)', 'f1.2xlarge (8vCPUs, 122.0GB RAM)', 'f1.4xlarge (16vCPUs, 244.0GB RAM)', 'g2.2xlarge (8vCPUs, 15.0GB RAM)', 'g2.8xlarge (32vCPUs, 60.0GB RAM)', 'g3.16xlarge (64vCPUs, 488.0GB RAM)', 'g3.4xlarge (16vCPUs, 122.0GB RAM)', 'g3.8xlarge (32vCPUs, 244.0GB RAM)', 'g3s.xlarge (4vCPUs, 30.5GB RAM)', 'g4ad.16xlarge (64vCPUs, 256.0GB RAM)', 'g4ad.4xlarge (16vCPUs, 64.0GB RAM)', 'g4ad.8xlarge (32vCPUs, 128.0GB RAM)', 'g4dn.12xlarge (48vCPUs, 192.0GB RAM)', 'g4dn.16xlarge (64vCPUs, 256.0GB RAM)', 'g4dn.2xlarge (8vCPUs, 32.0GB RAM)', 'g4dn.4xlarge (16vCPUs, 64.0GB RAM)', 'g4dn.8xlarge (32vCPUs, 128.0GB RAM)', 'g4dn.metal (96vCPUs, 384.0GB RAM)', 'g4dn.xlarge (4vCPUs, 16.0GB RAM)', 'h1.16xlarge (64vCPUs, 256.0GB RAM)', 'h1.2xlarge (8vCPUs, 32.0GB RAM)', 'h1.4xlarge (16vCPUs, 64.0GB RAM)', 'h1.8xlarge (32vCPUs, 128.0GB RAM)', 'i2.2xlarge (8vCPUs, 61.0GB RAM)', 'i2.4xlarge (16vCPUs, 122.0GB RAM)', 'i2.8xlarge (32vCPUs, 244.0GB RAM)', 'i2.xlarge (4vCPUs, 30.5GB RAM)', 'i3.16xlarge (64vCPUs, 488.0GB RAM)', 'i3.2xlarge (8vCPUs, 61.0GB RAM)', 'i3.4xlarge (16vCPUs, 122.0GB RAM)', 'i3.8xlarge (32vCPUs, 244.0GB RAM)', 'i3.large (2vCPUs, 15.25GB RAM)', 'i3.metal (72vCPUs, 512.0GB RAM)', 'i3.xlarge (4vCPUs, 30.5GB RAM)', 'i3en.12xlarge (48vCPUs, 384.0GB RAM)', 'i3en.24xlarge (96vCPUs, 768.0GB RAM)', 'i3en.2xlarge (8vCPUs, 64.0GB RAM)', 'i3en.3xlarge (12vCPUs, 96.0GB RAM)', 'i3en.6xlarge (24vCPUs, 192.0GB RAM)', 'i3en.large (2vCPUs, 16.0GB RAM)', 'i3en.metal (96vCPUs, 768.0GB RAM)', 'i3en.xlarge (4vCPUs, 32.0GB RAM)', 'inf1.24xlarge (96vCPUs, 192.0GB RAM)', 'inf1.2xlarge (8vCPUs, 16.0GB RAM)', 'inf1.6xlarge (24vCPUs, 48.0GB RAM)', 'inf1.xlarge (4vCPUs, 8.0GB RAM)', 'm1.large (2vCPUs, 7.5GB RAM)', 'm1.medium (1vCPUs, 3.69921875GB RAM)', 'm1.small (1vCPUs, 1.69921875GB RAM)', 'm1.xlarge (4vCPUs, 15.0GB RAM)', 'm2.2xlarge (4vCPUs, 34.19921875GB RAM)', 'm2.4xlarge (8vCPUs, 68.3994140625GB RAM)', 'm2.xlarge (2vCPUs, 17.099609375GB RAM)', 'm3.2xlarge (8vCPUs, 30.0GB RAM)', 'm3.large (2vCPUs, 7.5GB RAM)', 'm3.medium (1vCPUs, 3.75GB RAM)', 'm3.xlarge (4vCPUs, 15.0GB RAM)', 'm4.10xlarge (40vCPUs, 160.0GB RAM)', 'm4.16xlarge (64vCPUs, 256.0GB RAM)', 'm4.2xlarge (8vCPUs, 32.0GB RAM)', 'm4.4xlarge (16vCPUs, 64.0GB RAM)', 'm4.large (2vCPUs, 8.0GB RAM)', 'm4.xlarge (4vCPUs, 16.0GB RAM)', 'm5.12xlarge (48vCPUs, 192.0GB RAM)', 'm5.16xlarge (64vCPUs, 256.0GB RAM)', 'm5.24xlarge (96vCPUs, 384.0GB RAM)', 'm5.2xlarge (8vCPUs, 32.0GB RAM)', 'm5.4xlarge (16vCPUs, 64.0GB RAM)', 'm5.8xlarge (32vCPUs, 128.0GB RAM)', 'm5.large (2vCPUs, 8.0GB RAM)', 'm5.metal (96vCPUs, 384.0GB RAM)', 'm5.xlarge (4vCPUs, 16.0GB RAM)', 'm5a.12xlarge (48vCPUs, 192.0GB RAM)', 'm5a.16xlarge (64vCPUs, 256.0GB RAM)', 'm5a.24xlarge (96vCPUs, 384.0GB RAM)', 'm5a.2xlarge (8vCPUs, 32.0GB RAM)', 'm5a.4xlarge (16vCPUs, 64.0GB RAM)', 'm5a.8xlarge (32vCPUs, 128.0GB RAM)', 'm5a.large (2vCPUs, 8.0GB RAM)', 'm5a.xlarge (4vCPUs, 16.0GB RAM)', 'm5ad.12xlarge (48vCPUs, 192.0GB RAM)', 'm5ad.16xlarge (64vCPUs, 256.0GB RAM)', 'm5ad.24xlarge (96vCPUs, 384.0GB RAM)', 'm5ad.2xlarge (8vCPUs, 32.0GB RAM)', 'm5ad.4xlarge (16vCPUs, 64.0GB RAM)', 'm5ad.8xlarge (32vCPUs, 128.0GB RAM)', 'm5ad.large (2vCPUs, 8.0GB RAM)', 'm5ad.xlarge (4vCPUs, 16.0GB RAM)', 'm5d.12xlarge (48vCPUs, 192.0GB RAM)', 'm5d.16xlarge (64vCPUs, 256.0GB RAM)', 'm5d.24xlarge (96vCPUs, 384.0GB RAM)', 'm5d.2xlarge (8vCPUs, 32.0GB RAM)', 'm5d.4xlarge (16vCPUs, 64.0GB RAM)', 'm5d.8xlarge (32vCPUs, 128.0GB RAM)', 'm5d.large (2vCPUs, 8.0GB RAM)', 'm5d.metal (96vCPUs, 384.0GB RAM)', 'm5d.xlarge (4vCPUs, 16.0GB RAM)', 'm5dn.12xlarge (48vCPUs, 192.0GB RAM)', 'm5dn.16xlarge (64vCPUs, 256.0GB RAM)', 'm5dn.24xlarge (96vCPUs, 384.0GB RAM)', 'm5dn.2xlarge (8vCPUs, 32.0GB RAM)', 'm5dn.4xlarge (16vCPUs, 64.0GB RAM)', 'm5dn.8xlarge (32vCPUs, 128.0GB RAM)', 'm5dn.large (2vCPUs, 8.0GB RAM)', 'm5dn.metal (96vCPUs, 384.0GB RAM)', 'm5dn.xlarge (4vCPUs, 16.0GB RAM)', 'm5n.12xlarge (48vCPUs, 192.0GB RAM)', 'm5n.16xlarge (64vCPUs, 256.0GB RAM)', 'm5n.24xlarge (96vCPUs, 384.0GB RAM)', 'm5n.2xlarge (8vCPUs, 32.0GB RAM)', 'm5n.4xlarge (16vCPUs, 64.0GB RAM)', 'm5n.8xlarge (32vCPUs, 128.0GB RAM)', 'm5n.large (2vCPUs, 8.0GB RAM)', 'm5n.metal (96vCPUs, 384.0GB RAM)', 'm5n.xlarge (4vCPUs, 16.0GB RAM)', 'm5zn.12xlarge (48vCPUs, 192.0GB RAM)', 'm5zn.2xlarge (8vCPUs, 32.0GB RAM)', 'm5zn.3xlarge (12vCPUs, 48.0GB RAM)', 'm5zn.6xlarge (24vCPUs, 96.0GB RAM)', 'm5zn.large (2vCPUs, 8.0GB RAM)', 'm5zn.metal (48vCPUs, 192.0GB RAM)', 'm5zn.xlarge (4vCPUs, 16.0GB RAM)', 'p2.16xlarge (64vCPUs, 732.0GB RAM)', 'p2.8xlarge (32vCPUs, 488.0GB RAM)', 'p2.xlarge (4vCPUs, 61.0GB RAM)', 'p3.16xlarge (64vCPUs, 488.0GB RAM)', 'p3.2xlarge (8vCPUs, 61.0GB RAM)', 'p3.8xlarge (32vCPUs, 244.0GB RAM)', 'p3dn.24xlarge (96vCPUs, 768.0GB RAM)', 'p4d.24xlarge (96vCPUs, 1152.0GB RAM)', 'r3.2xlarge (8vCPUs, 61.0GB RAM)', 'r3.4xlarge (16vCPUs, 122.0GB RAM)', 'r3.8xlarge (32vCPUs, 244.0GB RAM)', 'r3.large (2vCPUs, 15.0GB RAM)', 'r3.xlarge (4vCPUs, 30.5GB RAM)', 'r4.16xlarge (64vCPUs, 488.0GB RAM)', 'r4.2xlarge (8vCPUs, 61.0GB RAM)', 'r4.4xlarge (16vCPUs, 122.0GB RAM)', 'r4.8xlarge (32vCPUs, 244.0GB RAM)', 'r4.large (2vCPUs, 15.25GB RAM)', 'r4.xlarge (4vCPUs, 30.5GB RAM)', 'r5.12xlarge (48vCPUs, 384.0GB RAM)', 'r5.16xlarge (64vCPUs, 512.0GB RAM)', 'r5.24xlarge (96vCPUs, 768.0GB RAM)', 'r5.2xlarge (8vCPUs, 64.0GB RAM)', 'r5.4xlarge (16vCPUs, 128.0GB RAM)', 'r5.8xlarge (32vCPUs, 256.0GB RAM)', 'r5.large (2vCPUs, 16.0GB RAM)', 'r5.metal (96vCPUs, 768.0GB RAM)', 'r5.xlarge (4vCPUs, 32.0GB RAM)', 'r5a.12xlarge (48vCPUs, 384.0GB RAM)', 'r5a.16xlarge (64vCPUs, 512.0GB RAM)', 'r5a.24xlarge (96vCPUs, 768.0GB RAM)', 'r5a.2xlarge (8vCPUs, 64.0GB RAM)', 'r5a.4xlarge (16vCPUs, 128.0GB RAM)', 'r5a.8xlarge (32vCPUs, 256.0GB RAM)', 'r5a.large (2vCPUs, 16.0GB RAM)', 'r5a.xlarge (4vCPUs, 32.0GB RAM)', 'r5ad.12xlarge (48vCPUs, 384.0GB RAM)', 'r5ad.16xlarge (64vCPUs, 512.0GB RAM)', 'r5ad.24xlarge (96vCPUs, 768.0GB RAM)', 'r5ad.2xlarge (8vCPUs, 64.0GB RAM)', 'r5ad.4xlarge (16vCPUs, 128.0GB RAM)', 'r5ad.8xlarge (32vCPUs, 256.0GB RAM)', 'r5ad.large (2vCPUs, 16.0GB RAM)', 'r5ad.xlarge (4vCPUs, 32.0GB RAM)', 'r5b.12xlarge (48vCPUs, 384.0GB RAM)', 'r5b.16xlarge (64vCPUs, 512.0GB RAM)', 'r5b.24xlarge (96vCPUs, 768.0GB RAM)', 'r5b.2xlarge (8vCPUs, 64.0GB RAM)', 'r5b.4xlarge (16vCPUs, 128.0GB RAM)', 'r5b.8xlarge (32vCPUs, 256.0GB RAM)', 'r5b.large (2vCPUs, 16.0GB RAM)', 'r5b.metal (96vCPUs, 768.0GB RAM)', 'r5b.xlarge (4vCPUs, 32.0GB RAM)', 'r5d.12xlarge (48vCPUs, 384.0GB RAM)', 'r5d.16xlarge (64vCPUs, 512.0GB RAM)', 'r5d.24xlarge (96vCPUs, 768.0GB RAM)', 'r5d.2xlarge (8vCPUs, 64.0GB RAM)', 'r5d.4xlarge (16vCPUs, 128.0GB RAM)', 'r5d.8xlarge (32vCPUs, 256.0GB RAM)', 'r5d.large (2vCPUs, 16.0GB RAM)', 'r5d.metal (96vCPUs, 768.0GB RAM)', 'r5d.xlarge (4vCPUs, 32.0GB RAM)', 'r5dn.12xlarge (48vCPUs, 384.0GB RAM)', 'r5dn.16xlarge (64vCPUs, 512.0GB RAM)', 'r5dn.24xlarge (96vCPUs, 768.0GB RAM)', 'r5dn.2xlarge (8vCPUs, 64.0GB RAM)', 'r5dn.4xlarge (16vCPUs, 128.0GB RAM)', 'r5dn.8xlarge (32vCPUs, 256.0GB RAM)', 'r5dn.large (2vCPUs, 16.0GB RAM)', 'r5dn.metal (96vCPUs, 768.0GB RAM)', 'r5dn.xlarge (4vCPUs, 32.0GB RAM)', 'r5n.12xlarge (48vCPUs, 384.0GB RAM)', 'r5n.16xlarge (64vCPUs, 512.0GB RAM)', 'r5n.24xlarge (96vCPUs, 768.0GB RAM)', 'r5n.2xlarge (8vCPUs, 64.0GB RAM)', 'r5n.4xlarge (16vCPUs, 128.0GB RAM)', 'r5n.8xlarge (32vCPUs, 256.0GB RAM)', 'r5n.large (2vCPUs, 16.0GB RAM)', 'r5n.metal (96vCPUs, 768.0GB RAM)', 'r5n.xlarge (4vCPUs, 32.0GB RAM)', 't1.micro (1vCPUs, 0.6123046875GB RAM)', 't2.2xlarge (8vCPUs, 32.0GB RAM)', 't2.large (2vCPUs, 8.0GB RAM)', 't2.medium (2vCPUs, 4.0GB RAM)', 't2.micro (1vCPUs, 1.0GB RAM)', 't2.nano (1vCPUs, 0.5GB RAM)', 't2.small (1vCPUs, 2.0GB RAM)', 't2.xlarge (4vCPUs, 16.0GB RAM)', 't3.2xlarge (8vCPUs, 32.0GB RAM)', 't3.large (2vCPUs, 8.0GB RAM)', 't3.medium (2vCPUs, 4.0GB RAM)', 't3.micro (2vCPUs, 1.0GB RAM)', 't3.nano (2vCPUs, 0.5GB RAM)', 't3.small (2vCPUs, 2.0GB RAM)', 't3.xlarge (4vCPUs, 16.0GB RAM)', 't3a.2xlarge (8vCPUs, 32.0GB RAM)', 't3a.large (2vCPUs, 8.0GB RAM)', 't3a.medium (2vCPUs, 4.0GB RAM)', 't3a.micro (2vCPUs, 1.0GB RAM)', 't3a.nano (2vCPUs, 0.5GB RAM)', 't3a.small (2vCPUs, 2.0GB RAM)', 't3a.xlarge (4vCPUs, 16.0GB RAM)', 'u-12tb1.112xlarge (448vCPUs, 12288.0GB RAM)', 'u-6tb1.112xlarge (448vCPUs, 6144.0GB RAM)', 'u-6tb1.56xlarge (224vCPUs, 6144.0GB RAM)', 'u-9tb1.112xlarge (448vCPUs, 9216.0GB RAM)', 'x1.16xlarge (64vCPUs, 976.0GB RAM)', 'x1.32xlarge (128vCPUs, 1952.0GB RAM)', 'x1e.16xlarge (64vCPUs, 1952.0GB RAM)', 'x1e.2xlarge (8vCPUs, 244.0GB RAM)', 'x1e.32xlarge (128vCPUs, 3904.0GB RAM)', 'x1e.4xlarge (16vCPUs, 488.0GB RAM)', 'x1e.8xlarge (32vCPUs, 976.0GB RAM)', 'x1e.xlarge (4vCPUs, 122.0GB RAM)', 'z1d.12xlarge (48vCPUs, 384.0GB RAM)', 'z1d.2xlarge (8vCPUs, 64.0GB RAM)', 'z1d.3xlarge (12vCPUs, 96.0GB RAM)', 'z1d.6xlarge (24vCPUs, 192.0GB RAM)', 'z1d.large (2vCPUs, 16.0GB RAM)', 'z1d.metal (48vCPUs, 384.0GB RAM)', 'z1d.xlarge (4vCPUs, 32.0GB RAM)']


EC2_TYPES_CACHE_KEY = 'aws_ec2_types_v1'


def get_ec2_types(key_id='', key_secret='', region='us-east-1'):
    """
    EC2 机型清单改为按官方 describe_instance_types 实时拉取,
    上面的 EC2_TYPES 只作为拉取失败(无可用账号/网络异常)时的兜底
    """
    cache_token = f'{EC2_TYPES_CACHE_KEY}_{region}'
    try:
        from django.core.cache import cache
        cached = cache.get(cache_token)
        if cached:
            return cached
    except Exception:
        cache = None

    if not key_id or not key_secret:
        return EC2_TYPES

    try:
        aApi = AwsApi(key_id, key_secret)
        aApi.region = region
        aApi.start('ec2')
        types = []
        paginator = aApi.client.get_paginator('describe_instance_types')
        for page in paginator.paginate():
            for item in page.get('InstanceTypes', []):
                name = item.get('InstanceType', '')
                if not name:
                    continue
                vcpus = item.get('VCpuInfo', {}).get('DefaultVCpus', '')
                memory = round(item.get('MemoryInfo', {}).get('SizeInMiB', 0) / 1024, 1)
                # 前端会按空格切开取第一个字段作为机型, 这里保持原有格式
                types.append(f'{name} ({vcpus}vCPUs, {memory}GB RAM)')
        if types:
            types.sort()
            try:
                cache.set(cache_token, types, 60 * 60 * 24)
            except Exception:
                pass
            return types
    except Exception as e:
        print(f'获取 EC2 机型列表失败: {e}')
        # 凭证失效/网络异常时短暂缓存兜底结果, 避免每次打开列表都去请求一次 AWS
        try:
            cache.set(cache_token, EC2_TYPES, 60 * 10)
        except Exception:
            pass

    return EC2_TYPES


def b64en(text):
    import base64
    return str(base64.b64encode(text.encode('utf-8')), 'utf-8')

# USER_DATA = b64en(USER_DATA)

def get_regions(name):
    regions = {
        'us-east-2': '美国-俄亥俄',
        'us-east-1': '美国-弗吉尼亚',
        'us-west-1': '美国-加利福尼亚',
        'us-west-2': '美国-俄勒冈',
        'af-south-1': '非洲-开普敦',
        'ap-south-1': '印度-孟买',
        'ap-northeast-3': '日本-大阪',
        'ap-northeast-2': '韩国-首尔',
        'ap-southeast-1': '新加坡',
        'ap-southeast-2': '澳洲-悉尼',
        'ap-northeast-1': '日本-东京',
        'ca-central-1': '加拿大',
        'ap-east-1': '中国-香港',
        'cn-north-1': '中国-北京',
        'cn-northwest-1': '中国-宁夏',
        'eu-central-1': '德国-法蘭克福',
        'eu-west-1': '愛爾蘭',
        'eu-west-2': '英国-倫敦',
        'eu-south-1': '意大利-米蘭',
        'eu-west-3': '法国-巴黎',
        'eu-north-1': '瑞典-斯德哥爾摩',
        'me-south-1': '中东-巴林',
        'sa-east-1': '巴西-圣保罗',
    }
    return regions.get(name, name)

# 轻量操作
def lightsail_action(action, lightsail):
    # 初始化 api
    aApi = AwsApi()
    aApi.region = lightsail.get_region()
    aApi.key_id = lightsail.account.key_id
    aApi.key_secret = lightsail.account.secret
    ret = ''
    aApi.start('lightsail')
    try:
        if action == 'start':
            # 开机
            ret = aApi.client.start_instance(instanceName=lightsail.name)

        if action == 'stop':
            # 关机
            ret = aApi.client.stop_instance(instanceName=lightsail.name)

        if action == 'restart':
            # 重启
            ret = aApi.client.reboot_instance(instanceName=lightsail.name)
        if action == 'delete':
            # 删除
            ret = aApi.client.delete_instance(instanceName=lightsail.name, forceDeleteAddOns=True)

        if action == 'reset_ip':
            # 更换ip
            # 1， 创建静态ip
            static_ip_name = f"static_ip_{lightsail.name}"
            aApi.lightsail_allocate_static_ip(static_ip_name)
            # 2, 为实例绑定静态ip
            aApi.lightsail_attach_static_ip(lightsail.name, static_ip_name)
            # 3, 释放静态ip
            aApi.lightsail_release_static_ip(static_ip_name)
            ret = aApi.client.get_instance(instanceName=lightsail.name)

        if action == 'open_port':
            # 开放端口
            ret = aApi.lightsail_put_instance_public_ports(lightsail.name)

        if action == 'update':
            # 更新实例
            ret = aApi.client.get_instance(instanceName=lightsail.name)
        if ret == '': raise BaseException('无效操作')
        return True, ret
    except BaseException as e:
        print(e)
        return False, '操作失败，可能当前状态无法操作，建议先更新！'


# ec2操作
def ec2_action(action, ec2):
    # 初始化 api
    aApi = AwsApi()
    aApi.region = ec2.region
    aApi.key_id = ec2.account.key_id
    aApi.key_secret = ec2.account.secret
    ret = ''
    aApi.start('ec2')
    try:
        if action == 'start':
            # 开机
            ret = aApi.client.start_instances(InstanceIds=[ec2.instance_id])

        if action == 'stop':
            # 关机
            ret = aApi.client.stop_instances(InstanceIds=[ec2.instance_id])

        if action == 'restart':
            # 重启
            ret = aApi.client.reboot_instances(InstanceIds=[ec2.instance_id])
        if action == 'delete':
            # 删除
            ret = aApi.client.terminate_instances(InstanceIds=[ec2.instance_id])

        if action == 'reset_ip':
            # 更换ip
            # 1， 创建静态ip
            AllocationId = aApi.ec2_allocate_address()
            # 2, 为实例绑定静态ip
            AssociationId = aApi.ec2_associate_address(AllocationId, ec2.instance_id, ec2.private_ip)
            # 3， 取消绑定ip
            aApi.ec2_disassociate_address(AssociationId)
            # 4, 释放ip
            aApi.ec2_release_address(AllocationId)
            # 5 更新实例信息
            ret = aApi.client.describe_instances(InstanceIds=[ec2.instance_id])['Reservations'][0]['Instances'][0]

        if action == 'update':
            # 更新实例
            ret = aApi.client.describe_instances(InstanceIds=[ec2.instance_id])['Reservations'][0]['Instances'][0]
            #print(ret)
        if ret == '': raise BaseException('无效操作')
        return True, ret
    except BaseException as e:
        print(e)
        return False, '操作失败，可能当前状态无法操作，建议先更新！'

# 创建aga
def _create_aga(_ec2_info):
    try:
        aApi = AwsApi()
        aApi.region = 'us-west-2'
        aApi.key_id = _ec2_info.account.key_id
        aApi.key_secret = _ec2_info.account.secret
        aApi.start('globalaccelerator')

        region = _ec2_info.region
        endpoint_id = _ec2_info.instance_id

        # 创建aga返回 arn
        aApi.create_aga_accelerator(region)
        aApi.create_listener(arn=aApi.aga_arn, Protocol='TCP')
        aApi.create_endpoint_group(arn=aApi.Listener_ARN, Protocol='TCP', region=region, eid=endpoint_id)

        aApi.create_listener(arn=aApi.aga_arn, Protocol='UDP')
        aApi.create_endpoint_group(arn=aApi.Listener_ARN, Protocol='TCP', region=region, eid=endpoint_id)
        return aApi._aga
    except BaseException as  e:
        print(
            e
        )
        return False

class AwsApi():
    def __init__(self, key_id='', key_secret=''):
        self.region = 'us-east-2'
        self.key_id = key_id
        self.key_secret = key_secret
        self.instances = []
        self.user_data = USER_DATA

    def start(self, name='lightsail', proxy=False):
        # proxy 参数保留是为了兼容旧调用, 已经不再使用固定代理
        self.client = boto3.client(name, region_name=self.region, aws_access_key_id=self.key_id,
                                   aws_secret_access_key=self.key_secret)
        return True

    # 获取全部实例
    def get_lightsail_full_instances(self, RegionName=''):
        if RegionName not in '':
            self.region = RegionName
            self.start('lightsail')
            self.get_lightsail_instances()
            return True

        # 先获取 地区列表
        response = self.client.get_regions()
        for region in response['regions']:
            self.region = region['name']
            self.start('lightsail')
            self.get_lightsail_instances()

    def get_lightsail_instances(self):
        response = self.client.get_instances()
        for _i in response['instances']:

            del _i['hardware']['disks']
            _data = {
                'name': _i['name'],
                'location': json.dumps(_i['location']),
                'hardware': json.dumps(_i['hardware']),
                'os_name': _i['blueprintName'],
                'os_id': _i['blueprintId'],
                'public_ip': _i.get('publicIpAddress', ''),
                'bundle_id': _i['bundleId'],
                'status': _i['state']['name'],
                'private_ip': _i.get('privateIpAddress', ''),
                'support_code': _i['supportCode'],
                'create_time': _i['createdAt'].strftime("%Y-%m-%d %H:%M:%S"),
                'update_time': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            self.instances.append(_data)
        return True

    # 创建轻量
    def create_lightsail_instances(self, name='string', blueprintId='centos_7_1901_01', bundleId='nano_2_0'):
        try:
            response = self.client.create_instances(
                instanceNames=[
                    name,
                ],
                availabilityZone=f'{self.region}a',
                blueprintId=blueprintId,
                bundleId=bundleId,
                userData=self.user_data,
                keyPairName='LightsailDefaultKeyPair',
                tags=[],
                addOns=[]
            )

            self.instance_id = response['operations'][0]['id']
            # self.instance = response['operations'][0]

            while True:
                ret = self.client.get_instance(instanceName=name)
                self.instance = ret['instance']
                if self.instance.get('state')['code'] != 0 : break
                time.sleep(3)
            self.lightsail_put_instance_public_ports(name)
            return True
        except:
            return False

    # 设置轻量端口
    def lightsail_put_instance_public_ports(self, name):
        try:
            response = self.client.put_instance_public_ports(
                portInfos=[
                    {
                        'fromPort': 0,
                        'toPort': 65535,
                        'protocol': 'all' ,
                        'cidrs': ['0.0.0.0/0'],
                    }
                ],
                instanceName=name
            )
            print(response)
            return True
        except BaseException as e:
            print(e)
            return False

    # 删除轻量
    def lightsail_delete_instance(self, name):
        try:
            response = self.client.delete_instance(
                instanceName=name,
                forceDeleteAddOns=True
            )
            return True
        except:
            return False

    # 轻量 添加 静态ip
    def lightsail_allocate_static_ip(self, name):
        try:
            self.client.allocate_static_ip(
                staticIpName=name
            )
            return True
        except:
            return False

    # 轻量 设置实例ip为静态
    def lightsail_attach_static_ip(self, instanceName, staticIpName):
        try:
            self.client.attach_static_ip(
                staticIpName=staticIpName,
                instanceName=instanceName
            )
            return True
        except:
            return False

    # 轻量 释放静态ip
    def lightsail_release_static_ip(self, staticIpName):
        try:
            response = self.client.release_static_ip(
                staticIpName=staticIpName,
            )
            self.response = response
            return True
        except:
            return False

    # 获取轻量规格
    def lightsail_get_bundles(self):
        try:
            response = self.client.get_bundles()
            self.bundle = []
            for bundle in response['bundles']:
                # isActive=False 是已停售的旧套餐(如 Gen2), 选了下单会失败
                if not bundle.get('isActive', True): continue
                if bundle['supportedPlatforms'][0] == 'WINDOWS': continue
                _data = {
                    'bundleId': bundle['bundleId'],
                    'cpuCount': bundle['cpuCount'],
                    'ramSizeInGb': bundle['ramSizeInGb'],
                    'diskSizeInGb': bundle['diskSizeInGb'],
                    'name': f"{bundle['cpuCount']}核 {bundle['ramSizeInGb']}G  {bundle['diskSizeInGb']}G  LINUX"
                }
                self.bundle.append(_data)
            return True
        except:
            return False

    # 创建 aga
    def create_aga_accelerator(self, name='string'):
        response = self.client.create_accelerator(
            Name = name,
            IpAddressType = 'IPV4',
            Enabled = True
        )
        self.aga_arn = response['Accelerator']['AcceleratorArn']
        _aga = response['Accelerator']
        _aga.update({
            'CreatedTime': (_aga['CreatedTime']).strftime("%Y-%m-%d %H:%M:%S"),
            'LastModifiedTime': (_aga['LastModifiedTime']).strftime("%Y-%m-%d %H:%M:%S"),
        })
        self._aga = _aga
        self.logs(response)
        self.logs(_aga)
        return True

    # 获取加速器
    def list_accelerators(self, delete=''):
        response = self.client.list_accelerators(
            MaxResults = 100
        )
        for _aga in response['Accelerators']:
            _data = {
                'arn': _aga['AcceleratorArn'],
                'name': _aga['Name'],
                'dns_name': _aga['DnsName'],
                'status': _aga['Status'],
                'enabled': _aga['Enabled'],
                'ip_address': ','.join(_aga['IpSets'][0]['IpAddresses']),
                'create_time': (_aga['CreatedTime']).strftime("%Y-%m-%d %H:%M:%S"),
                'update_time': datetime.datetime.now()
            }
            if delete == _aga['AcceleratorArn']: self.delete_accelerator(_aga)
            self.instances.append(_data)

    # 更新加速器
    def update_accelerator(self, arn, name, status=False):
        try:
            response = self.client.update_accelerator(
                AcceleratorArn=arn,
                Name=name,
                IpAddressType='IPV4',
                Enabled=status
            )
            self.response = response
            return True
        except:
            return False

    # 打印日志
    def logs(self, message):
        print(message)

    # 删除加速器
    def delete_accelerator(self, _aga):
        try:
            arn = _aga['AcceleratorArn']
            Enabled = _aga['Enabled']
            name = _aga['Name']
            status = _aga['Status']

            # 先删除 listeners
            self.list_listeners(arn)

            # 先停止加速器， 再删除
            if Enabled and status == 'DEPLOYED':
                self.update_accelerator(arn, name)
                self.message = '当前AGA处于开启状态，需要先停止后再进行删除，已经执行停止操作。'
                self.logs('当前AGA处于开启状态，需要先停止后再进行删除，已经执行停止操作。')
                return False

            # 判断 开启状态和部署状态
            if Enabled or status not in 'DEPLOYED':
                self.message = '当前AGA状态无法删除。'
                self.logs('当前AGA状态无法删除。')
                return False

            response = self.client.delete_accelerator(
                AcceleratorArn = arn,
            )
            self.response = response
            self.message = '删除成功'
            return True
        except BaseException as e:
            self.message = '删除失败'
            return False

    # 创建侦听器
    def create_listener(self, arn, Protocol='TCP'):
        try:
            response = self.client.create_listener(
                AcceleratorArn=arn,
                PortRanges=[
                    {
                        'FromPort': 1,
                        'ToPort': 65535
                    }
                ],
                Protocol = Protocol
            )
            self.Listener_ARN = response['Listener']['ListenerArn']
            return True
        except:
            return False

    # 创建对端
    def create_endpoint_group(self, arn, region, eid, Protocol='TCP'):
        response = self.client.create_endpoint_group(
            ListenerArn = arn,
            EndpointGroupRegion = region,
            EndpointConfigurations = [
                {
                    'EndpointId': eid,
                    'Weight': 128,
                    'ClientIPPreservationEnabled': True
                }
            ],
            TrafficDialPercentage = 100,
            HealthCheckPort = 61010,
            HealthCheckProtocol = Protocol,
            HealthCheckIntervalSeconds = 30,
            ThresholdCount=3
        )
        return response

    # 获取侦听器
    def list_listeners(self, arn):
        response = self.client.list_listeners(
            AcceleratorArn=arn,
            MaxResults=100,
        )
        for _listener in response['Listeners']:
            # 删除对端
            self.delete_endpoint_group(_listener['ListenerArn'])
            # 删除侦听器
            self.delete_listener(_listener['ListenerArn'])
        return True

    # 删除侦听器
    def delete_listener(self, arn):
        try:
            response = self.client.delete_listener(
                ListenerArn=arn
            )
            self.response = response
            return True
        except:
            return False

    # 删除对端, 传入 侦听器的 arn
    def delete_endpoint_group(self, arn):
        try:
            response = self.client.list_endpoint_groups(
                ListenerArn=arn,
                MaxResults=100
            )

            for _gorups in response['EndpointGroups']:
                self.client.delete_endpoint_group(
                    EndpointGroupArn=_gorups['EndpointGroupArn']
                )
            return True
        except:
            return False



    # 获取配额
    def get_service_quota(self):
        try:
            response = self.client.get_service_quota(ServiceCode='ec2', QuotaCode='L-1216C47A')
            # print(response)
            return int(response['Quota']['Value'])
        except:
            return False

    # 获取全部地区配额
    def get_all_service_quota(self):
        response = self.client.describe_regions()
        self.quota_list = []
        for region in response['Regions']:
            # print(region['RegionName'])
            self.region = region['RegionName']
            self.start('service-quotas')
            self.quota_list.append([self.region, get_regions(self.region), self.get_service_quota()])

    #####   EC2   ####
        # 获取全部实例
    def ec2_get_full_instances(self, RegionName=''):
        if RegionName not in '':
            self.region = RegionName
            self.start('ec2')
            self.ec2_describe_instances()
            return True

        # 先获取 地区列表
        response = self.client.describe_regions()
        for region in response['Regions']:
            # print(region['RegionName'])
            self.region = region['RegionName']
            self.start('ec2')
            self.ec2_describe_instances()
        return True

    # 获取实例列表
    def ec2_describe_instances(self):
        response = self.client.describe_instances(
            Filters=[],
            InstanceIds=[],
            MaxResults=100,
        )

        if self.region == 'ap-east-1':
            pass
            # print(response)


        for _instance in response['Reservations']:
            for __instance in _instance['Instances']:
                # print(__instance)
            #_instance = _instance['Instances'][0]
                name = '-'
                for _tag in __instance.get('Tags', []):
                    if _tag.get('Key', '') not in 'Name': continue
                    name = _tag.get('Value', '-')
                _data = {
                    'name': name,
                    'region': self.region,
                    'image_id': __instance['ImageId'],
                    'instance_id': __instance['InstanceId'],
                    'instance_type': __instance['InstanceType'],
                    'create_time': (__instance['LaunchTime'] + datetime.timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"),
                    'status': __instance['State']['Name'],
                    'private_ip': __instance.get('PrivateIpAddress', ''),
                    'public_ip': __instance.get('PublicIpAddress', ''),
                    'update_time': datetime.datetime.now()
                }
                self.instances.append(_data)

    # 创建ec2
    def ec2_create_instances(self, InstanceType='t2.micro', name='string', DiskSize=20, DeviceName='sda1', MaxCount=1, user_data=''):
        # 先获取默认安全组
        self.start('ec2', proxy=True)
        try:
            DiskSize = int(DiskSize)
            MaxCount = int(MaxCount)
            self.ec2_describe_default_security_groups()
            BlockDeviceMappings = [
                {
                    "DeviceName": f"/dev/{DeviceName}",
                    "Ebs": {
                        "VolumeSize": DiskSize,
                        "DeleteOnTermination": True,
                        "VolumeType": "gp2"
                    }
                }
            ]

            UserData = self.user_data
            UserData += user_data

            response = self.client.run_instances(
                BlockDeviceMappings=BlockDeviceMappings,
                UserData=UserData,
                ImageId=self.ImageId,
                InstanceType=InstanceType,
                MaxCount=MaxCount,
                MinCount=1,
                Monitoring={
                    'Enabled': False
                },
                SecurityGroupIds=[
                    self.GroupId,
                ]
            )
            self.response = response
            # 添加标签
            resource = response['Instances'][0]['InstanceId']
            self.ec2_create_tags(resource, 'Name', name)
            return True
        except BaseException as e:
            print(e)
            self.error_msg = str(e)
            return False

    # 创建默认安全组
    def create_default_ec2(self, ami, InstanceType='t2.micro', ):
        # 先获取默认安全组
        try:
            self.ec2_describe_default_security_groups()
            BlockDeviceMappings = [
                {
                    "DeviceName": f"/dev/xvda",
                    "Ebs": {
                        "VolumeSize": random.randint(10, 30),
                        "DeleteOnTermination": True,
                        "VolumeType": "gp2"
                    }
                }
            ]

            response = self.client.run_instances(
                BlockDeviceMappings=BlockDeviceMappings,
                # UserData=UserData,
                ImageId=ami,
                InstanceType=InstanceType,
                MaxCount=1,
                MinCount=1,
                Monitoring={
                    'Enabled': False
                },
                SecurityGroupIds=[
                    self.GroupId,
                ]
            )
            self.response = response
            self.instance_id = response['Instances'][0]['InstanceId']
            return True
        except BaseException as e:
            print(str(e))
            self.error_msg = str(e)
            return False



    # 创建vpc
    def ec2_create_vpc(self, cidr="10.0.0.0/24", name='panel'):
        self.cidr = cidr
        response = self.client.create_vpc(
            CidrBlock=cidr,
            AmazonProvidedIpv6CidrBlock=True,
            InstanceTenancy='default',
            TagSpecifications=[
                {
                    'ResourceType': 'vpc',
                    'Tags': [{
                        'Key': 'Name',
                        'Value': name
                    }]
                }
            ]
        )
        # 完成之后 还需要创建 子网
        # print(response)
        vpc_id = response['Vpc']['VpcId']
        self.VpcId = vpc_id
        self.ec2_create_subnet(vpc_id, cidr, name)
        self.ec2_create_internet_gateway('panel')

    def ec2_create_subnet(self, vpc, cidr="10.0.0.0/24", name='panel'):
        response = self.client.create_subnet(
            CidrBlock=cidr,
            VpcId=vpc,
            TagSpecifications=[
                {
                    'ResourceType': 'subnet',
                    'Tags': [{
                        'Key': 'Name',
                        'Value': name
                    }]
                }
            ]
        )
        self.SubnetId = response['Subnet']['SubnetId']
        return True

    # 创建互联网关
    def ec2_create_internet_gateway(self, name):
        response = self.client.create_internet_gateway(
            TagSpecifications=[
                {
                    'ResourceType': 'internet-gateway',
                    'Tags': [{
                        'Key': 'Name',
                        'Value': name
                    }]
                }
            ]
        )
        # print(response)
        self.internetGatewayId = response['InternetGateway']['InternetGatewayId']
        # print(self.internetGatewayId)

        # 互联网关附加到VPC
        self.client.attach_internet_gateway(
            InternetGatewayId=self.internetGatewayId,
            VpcId=self.VpcId
        )
        # 修改路由， 先查询到路由
        ret = self.client.describe_route_tables(
            Filters=[
                {
                    'Name': 'route.destination-cidr-block',
                    'Values': [
                        self.cidr,
                    ]
                }
            ]
        )
        RouteTableId = ret['RouteTables'][0]['Associations'][0]['RouteTableId']
        # 修改路由  添加路由
        self.client.create_route(
            DestinationCidrBlock='0.0.0.0/0',
            GatewayId=self.internetGatewayId,
            RouteTableId=RouteTableId
        )

    # ec2 添加TAG标签
    def ec2_create_tags(self, resource, key, value):

        try:
            response = self.client.create_tags(
                Resources=[
                    resource,
                ],
                Tags=[
                    {
                        'Key': key,
                        'Value': value
                    },
                ]
            )
            # self.response = response
            return True
        except:
            return False

    # ec2 查询安全组, 获取默认安全组
    def ec2_describe_default_security_groups(self, name='default'):
        try:
            response = self.client.describe_security_groups(
                GroupNames=[name]
            )
            self.GroupId = response['SecurityGroups'][0]['GroupId']
            self.ec2_authorize_security_group_ingress(self.GroupId)
            return True
        except BaseException as e:
            print(e)
            return False

    # 添加安全组规则
    def ec2_authorize_security_group_ingress(self, GroupID=''):
        try:
            self.client.authorize_security_group_ingress(
                GroupId = GroupID,
                IpPermissions=[
                    {
                        'IpProtocol': '-1',
                        'IpRanges': [
                            {
                                'CidrIp': '0.0.0.0/0',
                                'Description': 'string'
                            },
                        ],
                    },
                ]
            )
            return True
        except:
            return False

    # ec2 创建弹性ip
    def ec2_allocate_address(self):
        try:
            response = self.client.allocate_address(
                Domain='vpc'
            )
            return response['AllocationId']
        except:
            return False

    # ec2 关联IP
    def ec2_associate_address(self, AllocationId, InstanceId, privateIpAddress):
        try:
            response = self.client.associate_address(
                AllocationId=AllocationId,
                InstanceId=InstanceId,
                AllowReassociation=True,
                PrivateIpAddress=privateIpAddress
            )
            return response['AssociationId']
        except:
            return False

    # 取消关联实例
    def ec2_disassociate_address(self, AllocationId):
        try:
            response = self.client.disassociate_address(
                AssociationId=AllocationId
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except:
            return False

    # 释放弹性ip
    def ec2_release_address(self, AllocationId):
        try:
            response = self.client.release_address(
                AllocationId=AllocationId
            )
            return response['ResponseMetadata']['HTTPStatusCode']
        except:
            return False

# 创建默认vpc
def ec2_create_vpc():
    aApi = AwsApi()
    aApi.region = 'us-west-2'
    aApi.key_id = 'YOUR_AWS_ACCESS_KEY_ID'
    aApi.key_secret = 'YOUR_AWS_SECRET_ACCESS_KEY'
    aApi.start('ec2')
    aApi.ec2_create_vpc(cidr='10.12.0.0/24')

# 更新配额
def get_service_quota(key_id, key_secret):
    try:
        aApi = AwsApi()
        aApi.region = 'us-west-2'
        aApi.key_id = key_id
        aApi.key_secret = key_secret
        # 查询配额
        aApi.start('service-quotas')
        ret = aApi.client.get_service_quota(ServiceCode='ec2', QuotaCode='L-1216C47A')
        # ret = aApi.client.list_aws_default_service_quotas(ServiceCode='ec2')
        return int(ret['Quota']['Value'])
    except BaseException as e:
        print(e)
        return False

# 检测账号是否就绪
def get_account_status(key_id, key_secret):
    try:
        aApi = AwsApi()
        aApi.region = 'us-west-2'
        aApi.key_id = key_id
        aApi.key_secret = key_secret
        # 查询配额
        aApi.start('ec2')
        aApi.client.describe_regions()
        # ret = aApi.client.list_aws_default_service_quotas(ServiceCode='ec2')
        return True
    except BaseException as e:
        return False

def ec2_create_instances(key_id, key_secret):
    try:
        aApi = AwsApi()
        aApi.region = 'us-east-2'
        aApi.key_id = key_id
        aApi.key_secret = key_secret
        # 查询配额
        aApi.start('service-quotas')
        ret = aApi.client.get_service_quota(ServiceCode='ec2', QuotaCode='L-1216C47A')
        # ret = aApi.client.list_aws_default_service_quotas(ServiceCode='ec2')
        print(int(ret['Quota']['Value']))
        # aApi.start('ec2')
        # aApi.ImageId = 'ami-0443305dabd4be2bc'
        # aApi.ec2_create_instances(DeviceName='xvda')

        return True
    except BaseException as e:
        print(e)
        return False

    # aApi.ec2_create_vpc(cidr='10.12.0.0/24')



    # 查询配额
    # aApi.start('service-quotas')
    # ret = aApi.client.get_service_quota(ServiceCode='ec2', QuotaCode='L-34B43A08')
    # print(ret)


    # ret = aApi.client.get_bundles()
    #
    # for bundle in ret['bundles']:
    #     if bundle['supportedPlatforms'][0] == 'WINDOWS': continue
    #     _data = {
    #         'bundleId': bundle['bundleId'],
    #         'cpuCount': bundle['cpuCount'],
    #         'ramSizeInGb': bundle['ramSizeInGb'],
    #         'diskSizeInGb': bundle['diskSizeInGb'],
    #     }
    #     print(_data)

    # aApi.ec2_create_vpc(cidr='10.12.0.0/24')
    # ret = aApi.client.describe_route_tables(
    #     Filters=[
    #         {
    #             'Name': 'route.destination-cidr-block',
    #             'Values': [
    #                 '10.11.0.0/24',
    #             ]
    #         }
    #     ]
    # )
    # print(ret)
    # aApi.ec2_disassociate_address('eipassoc-0ce938668447393c0')


    # ret = aApi.client.describe_instance_types(
    #     Filters=[
    #         # {
    #         #     'Name': 'supported-root-device-type',
    #         #     'Values': [
    #         #         'ebs'
    #         #     ]
    #         # },
    #         # {
    #         #     'Name': 'processor-info.supported-architecture',
    #         #     'Values': [
    #         #         'x86_64'
    #         #     ]
    #         # },
    #         {
    #             'Name': 'free-tier-eligible',
    #             'Values': [
    #                 'true'
    #             ]
    #         },
    #
    #     ]
    # )
    # print(ret)
    # for _foo in ret['InstanceTypes']:
    #     print(_foo)
    #     print(_foo['InstanceType'])

def Organizations():
    """
    AWS Organizations 相关操作
    请通过环境变量或配置文件提供凭证信息
    """
    try:
        aApi = AwsApi()
        aApi.region = 'us-west-2'
        aApi.start('organizations')
        
        # 创建组织
        response = aApi.client.create_organization(
            FeatureSet='ALL'
        )
        return response
    except Exception as e:
        print(f"Error in Organizations: {str(e)}")
        return None


if __name__ == '__main__':
    # 用于开发测试的示例代码
    def test_service_quota():
        """测试服务配额功能"""
        try:
            test_key = os.getenv('AWS_ACCESS_KEY_ID')
            test_secret = os.getenv('AWS_SECRET_ACCESS_KEY')
            if not test_key or not test_secret:
                print("请设置 AWS_ACCESS_KEY_ID 和 AWS_SECRET_ACCESS_KEY 环境变量")
                return
            
            value = get_service_quota(test_key, test_secret)
            print(f"Current service quota: {value}")
        except Exception as e:
            print(f"Error in test_service_quota: {str(e)}")
    
    def test_account_status():
        """测试账号状态检查功能"""
        try:
            test_key = os.getenv('AWS_ACCESS_KEY_ID')
            test_secret = os.getenv('AWS_SECRET_ACCESS_KEY')
            if not test_key or not test_secret:
                print("请设置 AWS_ACCESS_KEY_ID 和 AWS_SECRET_ACCESS_KEY 环境变量")
                return
            
            status = get_account_status(test_key, test_secret)
            print(f"Account status: {'Ready' if status else 'Not Ready'}")
        except Exception as e:
            print(f"Error in test_account_status: {str(e)}")

    # 如果需要测试，取消下面的注释并确保设置了环境变量
    # test_service_quota()
    # test_account_status()