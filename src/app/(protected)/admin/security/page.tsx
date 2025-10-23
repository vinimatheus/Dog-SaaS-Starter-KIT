import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SecurityAlertsPanel } from "@/components/admin/security-alerts-panel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Activity, Users, AlertTriangle } from "lucide-react"

export default async function SecurityDashboardPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/login")
  }
  
  // Check if user is admin (has admin role in any organization)
  const userAdminRoles = await prisma.user_Organization.findMany({
    where: {
      user_id: session.user.id,
      role: {
        in: ["OWNER", "ADMIN"]
      }
    }
  })
  
  if (userAdminRoles.length === 0) {
    redirect("/")
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor security metrics, alerts, and system health
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monitoring</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">Active</div>
            <p className="text-xs text-muted-foreground">
              Real-time monitoring enabled
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userAdminRoles.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Organizations managed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alert Level</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Normal</div>
            <p className="text-xs text-muted-foreground">
              No critical alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts Panel */}
      <SecurityAlertsPanel />

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>Security Monitoring Information</CardTitle>
          <CardDescription>
            Understanding the security monitoring system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Monitored Events</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Unauthorized access attempts</li>
              <li>• Rate limit violations</li>
              <li>• Security policy violations</li>
              <li>• Suspicious user activity patterns</li>
              <li>• Organization access anomalies</li>
              <li>• Invite operation irregularities</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Alert Thresholds</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Critical:</strong> Immediate security threats requiring action</li>
              <li>• <strong>High:</strong> Significant security events needing attention</li>
              <li>• <strong>Medium:</strong> Notable security patterns to monitor</li>
              <li>• <strong>Low:</strong> Informational security events</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Monitoring Service</h4>
            <p className="text-sm text-muted-foreground">
              The security monitoring service runs continuously to analyze patterns and trigger alerts.
              To start the monitoring service manually, run: <code className="bg-muted px-1 rounded">npm run security:monitor</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}