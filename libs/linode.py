import json
import requests


class LinodeApi():
    def __init__(self, token):
        self.curl = requests.session()
        self.access_token = token
        self.curl.headers = {
            'content-type': 'application/json',
            'Authorization': f'Bearer {self.access_token}'
        }

    # 创建 linode 实例
    def create_instance(self, region, vm_size, image_id, password, name=''):
        url = 'https://api.linode.com/v4/linode/instances'
        data = {
            'image': image_id,
            'type': vm_size,
            'label': name,
            'region': region,
            "root_pass": password,
            "backups_enabled": False,
        }
        if not self.report_post(url, data):
            return False
        print(self.result)
        return True

    # 电源操作
    def power_action(self, instance_id, action):
        try:
            url = f'https://api.linode.com/v4/linode/instances/{instance_id}/{action}'
            if not self.report_post(url, data={}):
                return False
            if self.result.get('errors'):
                return False
            return True
        except:
            return False

    # 删除实例
    def delete_instance(self, linode_id):
        try:
            url = f'https://api.linode.com/v4/linode/instances/{linode_id}'
            result = self.curl.delete(url)
            if result.json().get('errors'):
                return False
            return True
        except:
            return False

    # 获取实例列表
    def get_instances(self):
        self.instances = []
        try:
            url = 'https://api.linode.com/v4/linode/instances'
            if not self.report_get(url): return False
            for instance in self.result['data']:
                # print(instance)
                try:
                    ipv4 = instance['ipv4'][0]
                except:
                    ipv4 = ''
                _instance = {
                    'instance_id': instance['id'],
                    'label': instance['label'],
                    'status': instance['status'],
                    'create_time': instance['created'],
                    'type': instance['type'],
                    'ipv4': ipv4,
                    'ipv6': instance['ipv6'],
                    'image': instance['image'],
                    'region': instance['region']
                }
                self.instances.append(_instance)
            return True
        except:
            return False

    def get_types(self):
        url = 'https://api.linode.com/v4/linode/types?page_size=500'
        if not self.report_get(url):
            return []
        _rows = []
        for _type in self.result.get('data', []):
            try:
                _id = _type['id']
                vcpus = _type['vcpus']
                price = int(float(_type['price']['monthly']))
                memory = int(_type['memory'] / 1024)
                disk = int(_type['disk'] / 1024)
            except Exception:
                continue
            label = f'{vcpus}vCPUs, {memory}GB RAM, {disk}GB DISK, ${price}'
            _rows.append((price, [_id, label]))
        # 按价格从低到高, 方便下单选规格
        _rows.sort(key=lambda x: (x[0], x[1][0]))
        return [row[1] for row in _rows]

    # 获取账户信息
    def get_account(self):
        try:
            url = 'https://api.linode.com/v4/account'
            return self.report_get(url)
        except:
            return False

    def get_regions(self):
        url = 'https://api.linode.com/v4/regions?page_size=500'
        if not self.report_get(url):
            return []
        regions = []
        for _i in self.result.get('data', []):
            _id = _i.get('id', '')
            if not _id:
                continue
            # 只保留支持开通 Linode 的地区
            if 'Linodes' not in (_i.get('capabilities') or []):
                continue
            label = REGION_CN.get(_id) or _i.get('label') or _id
            regions.append([_id, label])
        regions.sort(key=lambda x: x[0])
        return regions

    def get_images(self):
        url = 'https://api.linode.com/v4/images?page_size=500'
        if not self.report_get(url):
            return []
        images = []
        for img in self.result.get('data', []):
            img_id = img.get('id', '')
            if not img_id.startswith('linode/'):
                continue
            # 已弃用的镜像不会再更新, 不再提供创建入口
            if img.get('deprecated'):
                continue
            images.append([img_id, img.get('label') or img_id])
        images.sort(key=lambda x: x[0])
        return images

    # 统一发送请求
    def report_get(self, url):
        try:
            ret = self.curl.get(url)
            print(ret.text)
            self.result =ret.json()
            # print(self.result)
            self.ret =ret.json()
            return True
        except:
            return False

    # 统一发送请求
    def report_post(self, url, data):
        try:
            ret = self.curl.post(url, data=json.dumps(data))
            # print(ret.text)
            self.result = ret.json()
            return True
        except:
            return False

    # g6-nanode-1


# 官方地区的中文名, 新机房未收录时直接用官方返回的英文 label
REGION_CN = {
    'jp-osa': '日本-大阪',
    'ap-northeast': '日本-东京',
    'jp-tyo-3': '日本-东京3',
    'ap-south': '新加坡',
    'sg-sin-2': '新加坡2',
    'ap-west': '印度',
    'in-bom-2': '印度-孟买2',
    'in-maa': '印度-清奈',
    'eu-central': '德国',
    'de-fra-2': '德国-法兰克福2',
    'ca-central': '加拿大',
    'ap-southeast': '澳大利亚',
    'au-mel': '澳大利亚-墨尔本',
    'eu-west': '英国-伦敦',
    'gb-lon': '英国-伦敦2',
    'us-central': '美国中部-达拉斯',
    'us-west': '美国西部-费利蒙',
    'us-lax': '美国-洛杉矶',
    'us-southeast': '美国南部-亚特兰大',
    'us-east': '美国东部-新泽西',
    'us-iad': '美国-华盛顿',
    'us-iad-2': '美国-华盛顿2',
    'us-mia': '美国-迈阿密',
    'us-ord': '美国-芝加哥',
    'us-sea': '美国-西雅图',
    'fr-par': '法国-巴黎',
    'fr-par-2': '法国-巴黎2',
    'br-gru': '巴西-圣保罗',
    'nl-ams': '荷兰-阿姆斯特丹',
    'se-sto': '瑞典-斯德哥尔摩',
    'es-mad': '西班牙-马德里',
    'it-mil': '意大利-米兰',
    'id-cgk': '印尼-雅加达',
}


class LinodeCatalog():
    """
    Linode 的镜像 / 地区 / 规格属于平台级数据, 会随官方调整而变,
    统一从 v4 接口实时拉取并缓存, 拉取失败时才回落到静态表
    """

    CACHE_KEY = 'linode_catalog_v2'
    CACHE_TIMEOUT = 60 * 60 * 6

    @classmethod
    def get(cls, token='', fallback=None):
        fallback = fallback or {'images': [], 'regions': [], 'types': []}
        if not token:
            return fallback

        try:
            from django.core.cache import cache
        except Exception:
            cache = None

        if cache:
            cached = cache.get(cls.CACHE_KEY)
            if cached:
                return cached

        try:
            api = LinodeApi(token)
            data = {
                'images': api.get_images(),
                'regions': api.get_regions(),
                'types': api.get_types(),
            }
            # 三个列表都拿到才算成功, 否则用静态兜底, 避免下拉框为空
            if data['images'] and data['regions'] and data['types']:
                if cache:
                    cache.set(cls.CACHE_KEY, data, cls.CACHE_TIMEOUT)
                return data
        except Exception as e:
            print(e)

        # 拉取失败时短暂缓存兜底结果, 避免每次打开页面都去请求一次官方接口
        if cache:
            try:
                cache.set(cls.CACHE_KEY, fallback, 60 * 5)
            except Exception:
                pass

        return fallback


if __name__ == '__main__':
    pass
    # lApi = LinodeApi()
    # lApi.get_images()