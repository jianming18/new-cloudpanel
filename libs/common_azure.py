import re
import time

from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.subscription import SubscriptionClient
from azure.identity import ClientSecretCredential


class AzureClass():
    def __init__(self, tenant_id, client_id, secret):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.secret = secret
        self.subscription_id = None
        self.credential = ClientSecretCredential(
            tenant_id=self.tenant_id,
            client_id=self.client_id,
            client_secret=self.secret,
        )

    # 获取订阅列表
    def get_subscription_list(self):
        subscription_client = SubscriptionClient(self.credential)
        subscription_list = subscription_client.subscriptions.list()
        for subscription in subscription_list:
            print(subscription.subscription_id, subscription.display_name)

        return subscription_list

    # 创建资源组
    def create_resource_group(self, subscription_id, resource_group_name, location):
        resource_client = ResourceManagementClient(self.credential, subscription_id)
        result = resource_client.resource_groups.create_or_update(
            resource_group_name,
            {
                'location': location
            }
        )
        if not result.id:
            return True
        return False

    # 创建虚拟机
    def create_vm(self, subscription_id, group_name, tag, vm_size, image_name, username, password, location, disk_size):
        try:
            compute_client = ComputeManagementClient(self.credential, subscription_id)

            urn = image_name.split(':')

            # 定义各种资源名称
            resource_group_name = group_name
            vnet_name = f'{tag}_vnet'
            subnet_name = f'{tag}_subnet'
            ipconfig_name = f'{tag}_ipconfig'
            ip_name = f'{tag}_public_ip'
            nic_name = f'{tag}_nic'
            vm_name = tag

            # 创建资源组
            try:
                self.create_resource_group(subscription_id, resource_group_name, location)
            except:
                pass

            network_clinet = NetworkManagementClient(self.credential, subscription_id)

            # 创建虚拟网络
            print('正在创建虚拟网络')
            vnet_result = network_clinet.virtual_networks.create_or_update(
                resource_group_name,
                vnet_name,
                {
                    'location': location,
                    'address_space': {
                        'address_prefixes': ['10.0.0.0/16']
                    }
                }
            ).result()

            # 创建子网
            print('创建子网')
            subnet_result = network_clinet.subnets.create_or_update(
                resource_group_name,
                vnet_name,
                subnet_name,
                {
                    'address_prefix': '10.0.0.0/24'
                }
            ).result()

            # 创建公共IP
            # 注意: Basic SKU 公网IP 已于 2025-03-31 停止新建、2025-09-30 全面退役,
            # 官方要求统一使用 Standard SKU, 且 Standard SKU 只支持 Static 分配方式
            print('正在创建公共IP')
            public_ip_result = network_clinet.public_ip_addresses.create_or_update(
                resource_group_name,
                ip_name,
                {
                    'location': location,
                    'sku': {'name': 'Standard'},
                    'public_ip_allocation_method': 'Static',
                    'public_ip_address_version': 'IPV4'
                }
            ).result()

            # 创建网络安全组
            # Standard SKU 公网IP 默认拒绝所有入站流量, 必须由 NSG 显式放通端口, 否则实例建好也连不上
            print('正在创建网络安全组')
            nsg_name = f'{tag}_nsg'
            allow_ports = [22, 80, 443, 3389]
            security_rules = []
            for index, port in enumerate(allow_ports):
                security_rules.append({
                    'name': f'allow_tcp_{port}',
                    'protocol': 'Tcp',
                    'source_port_range': '*',
                    'destination_port_range': str(port),
                    'source_address_prefix': '*',
                    'destination_address_prefix': '*',
                    'access': 'Allow',
                    'priority': 1000 + index,
                    'direction': 'Inbound',
                })
            nsg_result = network_clinet.network_security_groups.create_or_update(
                resource_group_name,
                nsg_name,
                {
                    'location': location,
                    'security_rules': security_rules
                }
            ).result()

            # 创建网络接口, 需要先查询是否存
            print('正在创建网络接口')
            network_result = network_clinet.network_interfaces.create_or_update(
                resource_group_name,
                nic_name,
                {
                    'location': location,
                    'ip_configurations': [
                        {
                            'name': ipconfig_name,
                            'subnet': {
                                'id': subnet_result.id
                            },
                            'public_ip_address': {
                                'id': public_ip_result.id
                            }
                        }
                    ],
                    'network_security_group': {
                        'id': nsg_result.id
                    },
                    'enableAcceleratedNetworking': False

                }
            ).result()

            # 创建虚拟机
            print('正在创建虚拟机')
            result = compute_client.virtual_machines.create_or_update(
                resource_group_name,
                vm_name,
                {
                    'location': location,
                    'os_profile': {
                        'computer_name': vm_name,
                        'admin_username': username,
                        'admin_password': password
                    },
                    'hardware_profile': {
                        'vm_size': vm_size
                    },
                    'user_data': '',
                    # MicrosoftWindowsServer:WindowsServer:2019-datacenter-gensecond:latest
                    'storage_profile': {
                        'image_reference': {
                            "sku": urn[2],
                            "publisher": urn[0],
                            "version": urn[3],
                            "offer": urn[1]
                        },
                        'os_disk': {
                            'name': vm_name,
                            'caching': 'ReadWrite',
                            'create_option': 'FromImage',
                            'storage_account_type': 'StandardSSD_LRS',
                            'disk_size_gb': int(disk_size)
                        },
                    },
                    "network_profile": {
                        "network_interfaces": [{
                            "id": network_result.id,
                        }],
                    }
                }
            ).result()
            self.result = result
            return True
        except BaseException as e:
            self.error_log = str(e)
            return False

    # 删除虚拟机
    def delete_vm(self, subscription_id, group_name, vm_name):
        try:
            compute_client = ComputeManagementClient(self.credential, subscription_id)
            network_client = NetworkManagementClient(self.credential, subscription_id)

            # 先获取实例信息
            vm_info = compute_client.virtual_machines.get(group_name, vm_name)
            #
            disk_name = vm_info.storage_profile.os_disk.name
            nic_name = vm_info.network_profile.network_interfaces[0].id.split('/')[-1]

            # 删除虚拟机
            compute_client.virtual_machines.delete(group_name, vm_name)

            for i in range(50):
                try:
                    compute_client.virtual_machines.get(group_name, vm_name)
                    print(f'第 {i + 1} 次，VM还未删除成功，等待3秒之后重新查询')
                    time.sleep(3)
                    continue
                except:
                    print('VM删除成功')
                    break

            # 删除硬盘
            print('正在删除硬盘')
            compute_client.disks.delete(group_name, disk_name)

            # 获取网卡名称
            try:
                result = network_client.network_interfaces.get(group_name, nic_name)
                public_ip_name = result.ip_configurations[0].public_ip_address.id.split('/')[-1]
                # 记录网卡绑定的网络安全组, 网卡删除后再清理, 否则会残留
                nsg_name = ''
                if result.network_security_group and result.network_security_group.id:
                    nsg_name = result.network_security_group.id.split('/')[-1]
                print('正常删除网络接口')
                network_client.network_interfaces.delete(group_name, nic_name)
                # 延迟5秒之后再进行删除
                print('正在删除公共IP')
                network_client.public_ip_addresses.delete(group_name, public_ip_name)
                if nsg_name:
                    print('正在删除网络安全组')
                    network_client.network_security_groups.delete(group_name, nsg_name)
            except:
                pass
            return True
        except BaseException as e:
            self.error_log = str(e)
            return False

    # 大概错误详情
    def get_error_msg(self):
        # 订阅不存在
        if 'SubscriptionNotFound' in self.error_log:
            return '订阅不存在, 请删除账号重新获取'

        # 超过配额
        if 'Current Limit' in self.error_log:
            limit, usage, requ = re.findall(r'Current Limit: (\d+), Current Usage: (\d+), Additional Required: (\d+)', self.error_log)[0]

            return f'超过配额限制, 当前限制 {limit}vCPU, 已使用 {usage}vCPU, 需要 {requ}vCPU'

        # 大概率是名称相同导致的创建失败
        if 'and cannot be deleted' in self.error_log:
            return '可能是因为某个服务名称相同导致创建失败, 建议更改名称试试!'

        # 无法在其它区域创建
        if 'is currently not available in location' in self.error_log:
            return '无法在当前区域创建虚拟机, 请更换地区或者规格继续尝试!'

        return self.error_log

    # 删除资源组
    def delete_group(self, subscription_id, resource_group_name):
        resource_client = ResourceManagementClient(self.credential, subscription_id)
        resource_result = resource_client.resource_groups.delete(resource_group_name)
        print(resource_result.result())

    def get_public_ip_info(self, subscription_id, resource_group_name, ip_name):
        network_clinet = NetworkManagementClient(self.credential, subscription_id)
        nic_result = network_clinet.public_ip_addresses.get(resource_group_name, ip_name)
        print(nic_result)

    def get_all_vm(self, subscription_id):
        # 获取全部虚拟机, 先获取资源组列表
        resource_client = ResourceManagementClient(self.credential, subscription_id)
        for group in resource_client.resource_groups.list():
            # resource_client.resource_groups.delete(group.name)
            print(group)
            # self.get_vm_list(subscription_id, group.name)
            # break

    def get_vm_list(self, subscription_id):
        # 这部分代码是参考 https://github.com/1injex/azure-manager/blob/master/azure/function.py

        compute_client = ComputeManagementClient(self.credential, subscription_id)
        network_client = NetworkManagementClient(self.credential, subscription_id)

        vm_list = []
        for vm in compute_client.virtual_machines.list_all():
            group = re.findall(r'resourceGroups/(.+)/providers', vm.id)[0]
            images = [vm.storage_profile.image_reference.publisher, vm.storage_profile.image_reference.offer, vm.storage_profile.image_reference.sku, vm.storage_profile.image_reference.version]
            nic_name = vm.network_profile.network_interfaces[0].id.split('/')[-1]
            _data = {
                'name': vm.name,
                'vm_id': vm.vm_id,
                'location': vm.location,
                'group': group,
                'vm_size': vm.hardware_profile.vm_size,
                'os_disk': vm.storage_profile.os_disk.disk_size_gb,
                'nic_name': nic_name,
                'image': ':'.join(images)
            }
            try:
                # 获取网卡名称
                result = network_client.network_interfaces.get(group, nic_name)
                public_ip_name = result.ip_configurations[0].public_ip_address.id.split('/')[-1]
                _data.update({
                    'public_ip_name': public_ip_name
                })
                # 获取IP地址

                result = network_client.public_ip_addresses.get(group, public_ip_name)
                _data.update({
                    'ip': result.ip_address
                })
            except:
                pass

            try:
                # 更新实例状态
                status = compute_client.virtual_machines.instance_view(group, vm.name).statuses[1].display_status
                _data.update({
                    'status': status.replace('VM', '').strip(),
                })
            except:
                pass
            vm_list.append(_data)
        self.vm_list = vm_list
        return True

    # 获取虚拟机信息
    def get_vm_info(self, subscription_id, group_name, vm_name):
        try:
            compute_client = ComputeManagementClient(self.credential, subscription_id)
            network_client = NetworkManagementClient(self.credential, subscription_id)

            status = compute_client.virtual_machines.instance_view(group_name, vm_name).statuses[1].display_status

            vm = compute_client.virtual_machines.get(group_name, vm_name)

            group = re.findall(r'resourceGroups/(.+)/providers', vm.id)[0]
            images = [vm.storage_profile.image_reference.publisher, vm.storage_profile.image_reference.offer,
                      vm.storage_profile.image_reference.sku, vm.storage_profile.image_reference.version]
            nic_name = vm.network_profile.network_interfaces[0].id.split('/')[-1]
            _data = {
                'name': vm.name,
                'vm_id': vm.vm_id,
                'location': vm.location,
                'group': group,
                'vm_size': vm.hardware_profile.vm_size,
                'os_disk': vm.storage_profile.os_disk.disk_size_gb,
                'nic_name': nic_name,
                'status': status.replace('VM', '').strip(),
                'image': ':'.join(images),
                'public_ip_name': '',
                'ip': ''
            }
            try:
                # 获取网卡名称
                result = network_client.network_interfaces.get(group, nic_name)
                public_ip_name = result.ip_configurations[0].public_ip_address.id.split('/')[-1]
                _data.update({
                    'public_ip_name': public_ip_name
                })
                # 获取IP地址

                result = network_client.public_ip_addresses.get(group, public_ip_name)
                _data.update({
                    'ip': result.ip_address
                })
            except:
                pass

            self.vm_info = _data
            return True
        except:
            return False

    # 更改IP地址
    def change_ip(self, subscription_id, group_name, vm_name):
        compute_client = ComputeManagementClient(self.credential, subscription_id)
        network_clinet = NetworkManagementClient(self.credential, subscription_id)

        vm = compute_client.virtual_machines.get(group_name, vm_name)
        location = vm.location
        nic_name = vm.network_profile.network_interfaces[0].id.split('/')[-1]
        nic_info = network_clinet.network_interfaces.get(group_name, nic_name)

        ipconfig_name = nic_info.ip_configurations[0].name

        subnet_id = nic_info.ip_configurations[0].subnet.id
        try:
            public_ip_id = nic_info.ip_configurations[0].public_ip_address.id
            # 先解绑， 然后再绑定
            network_clinet.network_interfaces.create_or_update(
                group_name,
                nic_name,
                {
                    'location': location,
                    'ip_configurations': [
                        {
                            'name': ipconfig_name,
                            'subnet': {
                                'id': subnet_id
                            }
                        }
                    ],
                    'enableAcceleratedNetworking': False
                }
            ).result()
        except:
            # 可能公共IP不存在， 添加一个
            print('正在创建公共IP')
            public_ip_result = network_clinet.public_ip_addresses.create_or_update(
                group_name,
                f'{vm_name}_{int(time.time())}_public_ip',
                {
                    'location': location,
                    'sku': {'name': 'Basic'},
                    'public_ip_allocation_method': 'Dynamic',
                    'public_ip_address_version': 'IPV4'
                }
            ).result()
            public_ip_id = public_ip_result.id

        # # 创建网络接口
        print('绑定网络接口')
        network_clinet.network_interfaces.create_or_update(
            group_name,
            nic_name,
            {
                'location': location,
                'ip_configurations': [
                    {
                        'name': ipconfig_name,
                        'subnet': {
                            'id': subnet_id
                        },
                        'public_ip_address': {
                            'id': public_ip_id
                        }
                    }
                ],
                'enableAcceleratedNetworking': False
            }
        ).result()
        return True
        # self.get_vm_info(subscription_id, group_name, vm_name)
        #return





if __name__ == '__main__':
    pass
