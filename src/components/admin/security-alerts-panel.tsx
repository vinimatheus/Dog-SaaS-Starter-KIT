"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Shield, Clock, CheckCircle, XCircle } from "lucide-react"

type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

type SecurityAlert = {
  id: string
  type: string
  severity: AlertSeverity
  title: string
  description: string
  metadata: Record<string, any>
  timestamp: string
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
}

type SecurityDashboardData = {
  alerts: {
    active: SecurityAlert[]
    summary: {
      total: number
      critical: number
      high: number
      medium: number
      low: number
    }
  }
  metrics: {
    accessDenied: number
    rateLimitExceeded: number
    organizationAccess: {
      totalAccess: number
      successfulAccess: number
      deniedAccess: number
      uniqueUsers: number
    }
    securityViolations: {
      totalViolations: number
      violationsByType: Record<string, number>
      suspiciousUsers: string[]
    }
  }
  timeWindow: string
  timestamp: string
}

export function SecurityAlertsPanel() {
  const [dashboardData, setDashboardData] = useState<SecurityDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeWindow, setTimeWindow] = useState("24h")

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/security-dashboard?timeWindow=${timeWindow}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setDashboardData(data)
      setError(null)
    } catch (err) {
      console.error("Failed to fetch security dashboard data:", err)
      setError(err instanceof Error ? err.message : "Failed to load security data")
    } finally {
      setLoading(false)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch("/api/admin/security-dashboard", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alertId,
          action: "resolve"
        })
      })

      if (!response.ok) {
        throw new Error("Failed to resolve alert")
      }

      // Refresh dashboard data
      await fetchDashboardData()
    } catch (err) {
      console.error("Failed to resolve alert:", err)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [timeWindow])

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case "CRITICAL": return "destructive"
      case "HIGH": return "destructive"
      case "MEDIUM": return "default"
      case "LOW": return "secondary"
      default: return "secondary"
    }
  }

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case "CRITICAL": return <XCircle className="h-4 w-4" />
      case "HIGH": return <AlertTriangle className="h-4 w-4" />
      case "MEDIUM": return <Shield className="h-4 w-4" />
      case "LOW": return <Clock className="h-4 w-4" />
      default: return <Shield className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-red-200 bg-red-50 p-4 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-red-800">
                Failed to load security alerts: {error}
              </span>
            </div>
          </div>
          <Button 
            onClick={fetchDashboardData} 
            className="mt-4"
            variant="outline"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { alerts, metrics } = dashboardData!

  return (
    <div className="space-y-6">
      {/* Time Window Selector */}
      <div className="flex items-center gap-2">
        <label htmlFor="timeWindow" className="text-sm font-medium">
          Time Window:
        </label>
        <select
          id="timeWindow"
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value)}
          className="px-3 py-1 border rounded-md text-sm"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{alerts.summary.total}</div>
            <div className="text-sm text-muted-foreground">Total Alerts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{alerts.summary.critical}</div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{alerts.summary.high}</div>
            <div className="text-sm text-muted-foreground">High</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{alerts.summary.medium}</div>
            <div className="text-sm text-muted-foreground">Medium</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{alerts.summary.low}</div>
            <div className="text-sm text-muted-foreground">Low</div>
          </CardContent>
        </Card>
      </div>

      {/* Security Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.accessDenied}</div>
            <div className="text-sm text-muted-foreground">
              {metrics.organizationAccess.deniedAccess} org access denied
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rate Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.rateLimitExceeded}</div>
            <div className="text-sm text-muted-foreground">Rate limit violations</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Security Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.securityViolations.totalViolations}</div>
            <div className="text-sm text-muted-foreground">
              {metrics.securityViolations.suspiciousUsers.length} suspicious users
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Security Alerts
          </CardTitle>
          <CardDescription>
            Real-time security alerts requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.active.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mr-2" />
              No active security alerts
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.active.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alert.description}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}