import requests

import datetime

class DoApi():
    def __init__(self, token):
        self.curl = requests.session()
        self.token = token
        self.user_data = ""
        self.api_url = 'https://api.digitalocean.com'
        self.curl.headers = {
            'Authorization': f'Bearer {token}',
            # 'Content-Type': 'application/json'
        }

    # 获取账号信息
    def get_account(self):
        try:
            url = f'{self.api_url}/v2/account'
            if not self.report_get(url):
                print('获取失败')
                return False
            self.account_info = self.result['account']
            return True
        except BaseException as e:
            print(e)
            return False

    # 获取余额
    def get_balance(self):
        try:
            url = f'{self.api_url}/v2/customers/my/balance'
            if not self.report_get(url):
                print('获取失败')
                return False
            print(self.result)
            self.balance_info = self.result
            return True
        except:
            return False

    # 获取实例列表
    def get_droplets(self, tag_name=''):
        url = f"{self.api_url}/v2/droplets?tag_name={tag_name}"
        if not self.report_get(url):
            print('获取失败')
            return False
        self.droplets = []
        # print(self.result['droplets'])
        for droplet in self.result['droplets']:
            # print(json.dumps(droplet))
            _data = {
                'droplet_id': droplet['id'],
                'name': droplet['name'],
                'memory': droplet['memory'],
                'vcpus': droplet['vcpus'],
                'disk': droplet['disk'],
                'status': droplet['status'],
                'create_time': datetime.datetime.strptime(droplet['created_at'], "%Y-%m-%dT%H:%M:%SZ") + datetime.timedelta(hours=8),
                'size_slug': droplet['size_slug'],
                'image_slug': droplet['image']['slug'],
                'region_slug': droplet['region']['slug'],
            }

            if droplet['image']['slug'] == None:
                _data['image_slug'] = ''

            for _ip in droplet['networks']['v4']:
                if _ip['type'] == 'public':
                    ip = _ip['ip_address']
                    break
                continue
            else:
                ip = ''
            _data.update({
                'ip': ip
            })
            self.droplets.append(_data)
            # self.delete_droplet(droplet['id'])
        return True

    # 生成 cloud-init 启动脚本: 设置 root 密码并允许密码登录
    # DO 只有在不传 ssh_keys 时才需要靠 user_data 下发密码, 否则控制台密码是随机生成的
    @staticmethod
    def build_user_data(password=''):
        if not password:
            return ''
        # 单引号需要转义, 否则 shell 会截断
        safe_password = password.replace("'", "'\\''")
        return (
            '#!/bin/bash\n'
            f"echo 'root:{safe_password}' | chpasswd\n"
            "sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config\n"
            "sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config\n"
            "systemctl restart ssh 2>/dev/null || service ssh restart 2>/dev/null || true\n"
            "systemctl restart sshd 2>/dev/null || true\n"
        )

    # 创建实例
    def create_droplet(self, name='panel', password='admin7788==', count=1, region='sfo3', size='s-1vcpu-1gb', image='centos-7-x64'):
        try:
            url = f"{self.api_url}/v2/droplets"

            user_data = self.build_user_data(password)

            _data = {
                "names": [name] * int(count),
                # "name": name,
                "region": region,
                "size": size,
                "image": image,
                "ssh_keys": [],
                "ipv6": True,
                "tags": []
            }
            # 下发 root 密码, 不传的话 DO 会给账号邮箱发一个随机密码, 面板记录的密码就是错的
            if user_data:
                _data['user_data'] = user_data

            self.report_post(url, _data)
            print(self.result)
            droplets = self.result.get('droplets') or []
            if len(droplets) >= 1:
                self.created_droplets = droplets
                self._cache_password(droplets, password)
                return '创建成功', True
            return '创建失败', False
        except BaseException as e:
            print(e)
            return f'创建失败: {e}', False

    # 把刚创建的实例密码暂存到缓存, 供 update_droplets 落库时补全
    @staticmethod
    def _cache_password(droplets, password):
        if not password:
            return False
        try:
            from django.core.cache import cache
            for droplet in droplets:
                cache.set(f'do_password_{droplet.get("id")}', password, 60 * 60 * 24)
            return True
        except Exception as e:
            print(e)
            return False

    # 取出并清除缓存中的实例密码
    @staticmethod
    def pop_password(droplet_id):
        try:
            from django.core.cache import cache
            token = f'do_password_{droplet_id}'
            password = cache.get(token) or ''
            if password:
                cache.delete(token)
            return password
        except Exception:
            return ''

    def delete_droplet(self, droplet_id):
        try:
            url = f"{self.api_url}/v2/droplets/{droplet_id}"
            # print(url)
            ret = self.curl.delete(url, timeout=30)
            if ret.status_code == 204: return True
            return False
        except:
            return False

    @classmethod
    def get_images(cls, token=''):
        try:
            api_url = 'https://api.digitalocean.com'
            headers = {'Content-Type': 'application/json'}
            # /v2/images 必须带 token, 否则固定返回 401, 下拉框永远只能吃兜底列表
            if token:
                headers['Authorization'] = f'Bearer {token}'
            resp = requests.get(f'{api_url}/v2/images', params={'type': 'distribution'}, headers=headers, timeout=30)
            if resp.status_code != 200:
                return cls._fallback_images()
            slugs = set()
            for img in resp.json().get('images', []):
                s = img.get('slug', '')
                if any(s.startswith(p) for p in ['debian-12', 'debian-13', 'ubuntu-22-04', 'ubuntu-24-04']):
                    slugs.add(s)
            if slugs:
                return sorted(slugs)
        except Exception:
            pass
        return cls._fallback_images()

    @classmethod
    def _fallback_images(cls):
        return [
            'debian-13-x64',
            'debian-12-x64',
            'ubuntu-24-04-x64',
            'ubuntu-22-04-x64',
        ]

    def get_regions(self):
        try:
            url = f"{self.api_url}/v2/regions"
            if not self.report_get(url):
                print('获取失败')
                return False
            _data = []
            for region in self.result['regions']:
                _region = {
                    'name': region['name'],
                    'slug': region['slug'],
                    'sizes': region['sizes'],
                }
                _data.append(_region)
            self.regions = _data
            return True
        except:
            return False

    @classmethod
    def get_region_map(cls):
        data_list = [
            ('nyc1', '美国-纽约'),
            ('sfo3', '美国-旧金山'),
            ('ams3', '荷兰-阿姆斯特丹'),
            ('sgp1', '亚太-新加坡'),
            ('lon1', '英国-伦敦'),
            ('fra1', '德国-法兰克福'),
            ('tor1', '加拿大-多伦多'),
            ('blr1', '印度-班加罗尔')
        ]
        return data_list

    @classmethod
    def get_region_dist(cls):
        region_dist = {
            'nyc1': '美国-纽约',
            'sfo3': '美国-旧金山',
            'ams3': '荷兰-阿姆斯特丹',
            'sgp1': '亚太-新加坡',
            'lon1': '英国-伦敦',
            'fra1': '德国-法兰克福',
            'tor1': '加拿大-多伦多',
            'blr1': '印度-班加罗尔'
        }
        return region_dist

    @classmethod
    def get_price_map(cls):
        data_list = [
            ('s-1vcpu-1gb', '1H/1G/25G/1T-$5'),
            ('s-1vcpu-2gb', '1H/2G/50G/2T-$10'),
            ('s-2vcpu-2gb', '2H/2G/30G/3T-$15'),
            ('s-2vcpu-4gb', '2H/4G/80G/4T-$20'),
            ('s-4vcpu-8gb', '4H/8G/160G/5T-$40'),
            ## INTEL
            ('s-1vcpu-1gb-intel', '1H/1G/25G/1T-$6-intel'),
            ('s-1vcpu-2gb-intel', '1H/2G/50G/2T-$12-intel'),
            ('s-2vcpu-2gb-intel', '2H/2G/30G/3T-$18-intel'),
            ('s-2vcpu-4gb-intel', '2H/4G/80G/4T-$24-intel'),
            ('s-4vcpu-8gb-intel', '4H/8G/160G/5T-$48-intel'),
            ## AMD
            ('s-1vcpu-1gb-amd', '1H/1G/25G/1T-$6-amd'),
            ('s-1vcpu-2gb-amd', '1H/2G/50G/2T-$12-amd'),
            ('s-2vcpu-2gb-amd', '2H/2G/30G/3T-$18-amd'),
            ('s-2vcpu-4gb-amd', '2H/4G/80G/4T-$24-amd'),
            ('s-4vcpu-8gb-amd', '4H/8G/160G/5T-$48-amd'),
        ]
        return data_list

    # 统一get请求
    def report_get(self, url):
        try:
            ret = self.curl.get(url, headers=self.curl.headers)
            self.result = ret.json()
            return True
        except:
            return False

    # 统一get请求
    def report_post(self, url, data):
        try:
            ret = self.curl.post(url, data=data)
            self.result = ret.json()
            # print(ret.json())
            return True
        except BaseException as e:
            print(e)
            return False


if __name__ == '__main__':
    pass