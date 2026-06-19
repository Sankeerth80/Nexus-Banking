"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { PortalNavigation } from "@/components/portal-navigation";
import {
  Building2,
  CheckCircle2,
  FileCheck2,
  FileText,
  Fingerprint,
  Gauge,
  Landmark,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { publicEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";

type Transfer = {
  id: string;
  reference: string;
  type: string;
  amount: string;
  status: string;
  recipientDetails: string | null;
  createdAt: string;
  customer: {
    fullName: string;
    email: string;
  };
  sourceAccount?: { accountNumber: string };
  destinationAccount?: { accountNumber: string };
};

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor?: {
    fullName: string;
    email: string;
    role: string;
  } | null;
};

export default function AdminAuditPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
  const [transfersLoading, setTransfersLoading] = React.useState(true);
  const [auditLoading, setAuditLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Guard routing
  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // apiFetch wrapper
  const apiFetch = React.useCallback(
    async (path: string, options: RequestInit = {}) => {
      const baseUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
      const url = path.startsWith("http")
        ? path
        : `${baseUrl}/${path.replace(/^\//, "")}`;

      const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Request failed with status ${response.status}`,
        );
      }

      return response.json();
    },
    [],
  );

  const fetchTransfers = React.useCallback(async () => {
    setTransfersLoading(true);
    setError("");
    try {
      const data = await apiFetch("/transfers/admin");
      setTransfers(data);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load transactions."));
    } finally {
      setTransfersLoading(false);
    }
  }, [apiFetch]);

  const fetchAuditLogs = React.useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await apiFetch("/transfers/audit-logs");
      setAuditLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  }, [apiFetch]);

  React.useEffect(() => {
    if (user) {
      fetchTransfers();
      fetchAuditLogs();
    }
  }, [user, fetchTransfers, fetchAuditLogs]);

  const handleRefresh = () => {
    fetchTransfers();
    fetchAuditLogs();
  };

  if (loading || !user) return null;

  return (
    <main className="min-h-screen bg-banking-surface">
      <header className="enterprise-header">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Landmark className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal">
              {publicEnv.NEXT_PUBLIC_APP_NAME} Admin
            </h1>
            <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span>Welcome, {user.fullName}</span>
              <Badge
                variant="secondary"
                className="text-[9px] py-0 px-1 font-semibold uppercase tracking-wider"
              >
                {user.role}
              </Badge>
            </div>
          </div>

          <PortalNavigation />

          <ThemeToggle />
          <Button
            onClick={logout}
            variant="ghost"
            size="icon"
            className="md:ml-auto"
            aria-label="Log out"
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:py-6">
        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary">Security Audits</Badge>
              <Badge variant="outline">General Ledger Logs</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Platform Activity & Audit Logs
            </h2>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" /> Refresh Workspace
            </Button>
          </div>
        </section>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Auditing Sync Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="transfers" className="space-y-4">
          <TabsList className="bg-muted/40 p-1 border rounded-lg max-w-xs">
            <TabsTrigger value="transfers" className="text-xs">
              Transaction Ledger
            </TabsTrigger>
            <TabsTrigger value="audits" className="text-xs">
              Audit Logs
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Transfers Transaction history */}
          <TabsContent value="transfers">
            <Card className="border-border/60 bg-card/65 backdrop-blur-md">
              <CardHeader>
                <CardTitle>Core Transaction Registry</CardTitle>
                <CardDescription>
                  Comprehensive records of all transfer operations, networks,
                  and statuses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transfersLoading ? (
                  <div className="text-center py-12 text-sm text-muted-foreground animate-pulse">
                    Syncing database transaction ledger...
                  </div>
                ) : transfers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No transfer events recorded.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Reference</TableHead>
                          <TableHead className="text-xs">Customer</TableHead>
                          <TableHead className="text-xs">Method</TableHead>
                          <TableHead className="text-xs">
                            Debit Source
                          </TableHead>
                          <TableHead className="text-xs">
                            Recipient Details
                          </TableHead>
                          <TableHead className="text-xs">Amount</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {t.reference}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-semibold text-xs text-foreground">
                                  {t.customer?.fullName}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {t.customer?.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs uppercase tracking-wider font-semibold text-[10px]">
                              {t.type.replace("_", " ")}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {t.sourceAccount?.accountNumber || "N/A"}
                            </TableCell>
                            <TableCell className="text-xs truncate max-w-[12rem] font-medium">
                              {t.recipientDetails ||
                                (t.destinationAccount
                                  ? t.destinationAccount.accountNumber
                                  : "External Payee")}
                            </TableCell>
                            <TableCell className="font-semibold text-primary text-xs">
                              INR {Number(t.amount).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  t.status === "COMPLETED"
                                    ? "outline"
                                    : t.status === "FAILED" ||
                                        t.status === "CANCELLED"
                                      ? "destructive"
                                      : "secondary"
                                }
                                className={
                                  t.status === "COMPLETED"
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 text-[10px]"
                                    : "text-[10px]"
                                }
                              >
                                {t.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[10px] text-muted-foreground font-mono">
                              {new Date(t.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: System Audit Logs */}
          <TabsContent value="audits">
            <Card className="border-border/60 bg-card/65 backdrop-blur-md">
              <CardHeader>
                <CardTitle>Auditable System Actions</CardTitle>
                <CardDescription>
                  Tamper-proof event logs detailing maker-checker review
                  activities and transaction approvals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <div className="text-center py-12 text-sm text-muted-foreground animate-pulse">
                    Retrieving platform audit logs...
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No auditable system actions recorded.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Log ID</TableHead>
                          <TableHead className="text-xs">
                            Action Event
                          </TableHead>
                          <TableHead className="text-xs">
                            Entity Target
                          </TableHead>
                          <TableHead className="text-xs">
                            Actor Employee
                          </TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                              {log.id.slice(0, 8).toUpperCase()}...
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-foreground">
                              {log.action}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.entityType} (
                              {log.entityId.slice(0, 8).toUpperCase()})
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.actor ? (
                                <div>
                                  <p className="font-semibold text-xs text-foreground">
                                    {log.actor.fullName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {log.actor.email}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  System / Customer
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.actor ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] uppercase px-1"
                                >
                                  {log.actor.role}
                                </Badge>
                              ) : (
                                <span>-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-[10px] text-muted-foreground font-mono">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
