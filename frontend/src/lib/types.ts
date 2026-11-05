// 后端接口的数据结构定义 (与 Django 视图返回字段一一对应)

export interface Paged<T> {
  total: number
  items: T[]
}

export interface UserInfo {
  avatar: string
  name: string
  username: string
  email?: string
  create_time: string
  roles: string[]
  introduction?: string
}

export interface LoginResult {
  token: string
}

/** 形如 [id, 显示名] 的下拉项 */
export type OptionPair = [string, string]

export interface AwsAccount {
  id: number
  name: string
  email: string
  password: string
  key_id: string
  secret: string
  status: boolean
  value: string
  note: string
  create_time: string
  update_time: string
}

export interface LightsailInstance {
  id: number
  name: string
  os_name: string
  price: number
  public_ip: string
  status: string
  status_text: string
  region: string
  account: string
  password: string
  create_time: string
  update_time: string
  expire_time: string
}

export interface Ec2Instance {
  id: number
  name: string
  instance_id: string
  price: number
  public_ip: string
  status: string
  instance_type: string
  is_aga: boolean
  image_name: string
  status_text: string
  region: string
  create_time: string
  update_time: string
  expire_time: string
  account: string
  username: string
  password: string
}

export interface Ec2ListData extends Paged<Ec2Instance> {
  account_list: { id: number; name: string }[]
  ec2_types: string[]
  username: string
}

export interface LightsailBundle {
  bundleId: string
  cpuCount: number
  ramSizeInGb: number
  diskSizeInGb: number
  name: string
}

export interface LightsailImages {
  bundles: LightsailBundle[]
  blueprints: string[]
}

export interface AwsRegion {
  region: string
  name: string
}

export interface AzureAccount {
  id: number
  email: string
  password: string
  client_id: string
  tenant_id: string
  login_password: string
  subscription_id: string
  display_name: string
  note: string
  vm_count: number
  status: string
  status_text: string
  create_time: string
  update_time: string
}

export interface AzureAccountListData extends Paged<AzureAccount> {
  image_list: Record<string, string>
  location_list: Record<string, string>
  vm_sizes: Record<string, string>
}

export interface AzureVm {
  id: number
  name: string
  ip: string
  vm_id: string
  username: string
  password: string
  vm_size: string
  os_disk: string
  image: string
  region: string
  group: string
  status: string
  status_text: string
  create_time: string
  update_time: string
  account: string
  subscription_id: string
}

export interface DoAccount {
  id: number
  token: string
  name: string
  email: string
  password: string
  uuid: string
  month_to_date_balance: string
  status: string
  server_count: number
  droplet_limit: number
  note: string
  create_time: string
  update_time: string
}

export interface Droplet {
  id: number
  name: string
  droplet_id: number
  ip: string
  memory: number
  vcpus: number
  disk: number
  status: string
  image_slug: string
  region_slug: string
  create_time: string
  update_time: string
  password: string
  account: string
}

export interface DropletListData extends Paged<Droplet> {
  account_list: { id: number; name: string; note?: string }[]
  image_list: string[]
  region_list: OptionPair[]
  price_list: OptionPair[]
}

export interface LinodeAccount {
  id: number
  name: string
  euuid: string
  email: string
  password: string
  token: string
  status: boolean
  balance: string
  count: number
  note: string
  active_promotions: Record<string, unknown>
  create_time: string
  update_time: string
}

export interface LinodeAccountListData extends Paged<LinodeAccount> {
  image_list: OptionPair[]
  location_list: OptionPair[]
  vm_types: OptionPair[]
}

export interface LinodeVm {
  id: number
  name: string
  ipv4: string
  ipv6: string
  instance_id: number
  password: string
  type: string
  image: string
  region: string
  status: string
  status_text: string
  create_time: string
  update_time: string
  account: string
  account_name: string
}

export interface ScriptItem {
  id: number
  name: string
  content: string
  create_time: string
  update_time: string
}

export interface SiteOptions {
  [key: string]: string | boolean
}
