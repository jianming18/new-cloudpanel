import { Loader2 } from 'lucide-react'
import { Redirect, Route, Switch } from 'wouter'

import { AppLayout } from '@/components/layout/app-layout'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { AwsAccountsPage } from '@/pages/aws/accounts'
import { Ec2Page } from '@/pages/aws/ec2'
import { LightsailPage } from '@/pages/aws/lightsail'
import { AzurePage } from '@/pages/azure'
import { DashboardPage } from '@/pages/dashboard'
import { DigitalOceanPage } from '@/pages/do'
import { LinodePage } from '@/pages/linode'
import { LoginPage } from '@/pages/login'
import { NotFoundPage } from '@/pages/not-found'
import { ScriptsPage } from '@/pages/scripts'
import { SettingsPage } from '@/pages/settings'

function FullScreenLoading() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

function AuthenticatedShell() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/aws/lightsail" component={LightsailPage} />
        <Route path="/aws/ec2" component={Ec2Page} />
        <Route path="/aws/accounts" component={AwsAccountsPage} />
        <Route path="/azure" component={AzurePage} />
        <Route path="/do" component={DigitalOceanPage} />
        <Route path="/linode" component={LinodePage} />
        <Route path="/scripts" component={ScriptsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </AppLayout>
  )
}

function Shell() {
  const { user, ready } = useAuth()

  if (!ready) return <FullScreenLoading />

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route>{() => (user ? <AuthenticatedShell /> : <Redirect to="/login" />)}</Route>
    </Switch>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
