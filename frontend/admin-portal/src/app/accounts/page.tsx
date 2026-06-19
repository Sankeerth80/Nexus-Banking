"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileText,
  Fingerprint,
  Gauge,
  Headphones,
  Landmark,
  LifeBuoy,
  LockKeyhole,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  AlertCircle,
  Clock,
  Check,
  LogOut,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { publicEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";

type Account = {
  id: string;
  accountNumber: string;
  type: string;
  currency: string;
  balance: string;
  interestRate: string;
  ifsc: string;
  branchCode: string;
  status: string;
  customerId: string;
  createdAt: string;
  customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
};

export default function AdminAccountsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(true);

  // Create account states
  const [customerId, setCustomerId] = React.useState("");
  const [type, setType] = React.useState("SAVINGS");
  const [balance, setBalance] = React.useState("");
  const [interestRate, setInterestRate] = React.useState("");
  const [ifsc, setIfsc] = React.useState("NEXB0000001");
  const [branchCode, setBranchCode] = React.useState("HQ001");

  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

  // Edit account states
  const [editingAccountId, setEditingAccountId] = React.useState<string | null>(
    null,
  );
  const [editType, setEditType] = React.useState("");
  const [editInterestRate, setEditInterestRate] = React.useState("");
  const [editIfsc, setEditIfsc] = React.useState("");
  const [editBranchCode, setEditBranchCode] = React.useState("");

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

  const fetchAccounts = React.useCallback(async () => {
    setAccountsLoading(true);
    setError("");
    try {
      const data = await apiFetch("/accounts/admin");
      setAccounts(data);
    } catch (error: unknown) {
      setError(
        getErrorMessage(error, "Failed to load bank accounts registry."),
      );
    } finally {
      setAccountsLoading(false);
    }
  }, [apiFetch]);

  React.useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user, fetchAccounts]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setActionLoading(true);

    try {
      await apiFetch("/accounts", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          type,
          balance: balance ? Number(balance) : 0,
          interestRate: interestRate ? Number(interestRate) : 0,
          ifsc,
          branchCode,
        }),
      });

      setSuccess("Account provisioned successfully!");
      setCustomerId("");
      setBalance("");
      setInterestRate("");
      fetchAccounts();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to create account."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    try {
      await apiFetch(`/accounts/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAccounts();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to toggle account status."));
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this account? This cannot be undone.",
      )
    )
      return;
    try {
      await apiFetch(`/accounts/${id}`, { method: "DELETE" });
      fetchAccounts();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to delete account."));
    }
  };

  const startEditAccount = (acc: Account) => {
    setEditingAccountId(acc.id);
    setEditType(acc.type);
    setEditInterestRate(acc.interestRate);
    setEditIfsc(acc.ifsc);
    setEditBranchCode(acc.branchCode);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await apiFetch(`/accounts/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          type: editType,
          interestRate: Number(editInterestRate),
          ifsc: editIfsc,
          branchCode: editBranchCode,
        }),
      });
      setEditingAccountId(null);
      fetchAccounts();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to save edits."));
    }
  };

  if (loading || !user) return null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)]">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
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

          <nav className="flex items-center gap-4 ml-6">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              KYC Onboarding
            </Link>
            <Link
              href="/accounts"
              className="text-sm font-semibold text-primary transition-colors"
            >
              Account Controls
            </Link>
            <Link
              href="/cards"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Card Registry
            </Link>
            <Link
              href="/audit"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Auditing & Logs
            </Link>
          </nav>

          <ThemeToggle />
          <Button
            onClick={logout}
            variant="ghost"
            size="icon"
            className="ml-auto"
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
              <Badge className="bg-primary">Ops Workspace</Badge>
              <Badge variant="outline">Account Ledger Console</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Master Ledger & Accounts
            </h2>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchAccounts}
              variant="outline"
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" /> Refresh Registry
            </Button>
          </div>
        </section>

        {success && (
          <Alert className="border-emerald-500/25 bg-emerald-500/5 text-emerald-500">
            <Check className="size-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Operation Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Master Accounts Table */}
        <Card className="border-border/60 bg-card/65 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Provisioned Bank Accounts</CardTitle>
            <CardDescription>
              A comprehensive listing of all active customer products and
              balances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="text-center py-12 text-sm text-muted-foreground animate-pulse">
                Fetching accounts ledger...
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No bank accounts registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Product Type</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>IFSC / Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-sm">
                              {acc.customer?.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {acc.customer?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {acc.accountNumber}
                        </TableCell>
                        <TableCell>
                          {editingAccountId === acc.id ? (
                            <Select
                              onValueChange={setEditType}
                              value={editType}
                            >
                              <SelectTrigger className="h-8 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SAVINGS">SAVINGS</SelectItem>
                                <SelectItem value="CURRENT">CURRENT</SelectItem>
                                <SelectItem value="SALARY">SALARY</SelectItem>
                                <SelectItem value="FIXED_DEPOSIT">
                                  FIXED DEPOSIT
                                </SelectItem>
                                <SelectItem value="RECURRING_DEPOSIT">
                                  RECURRING DEPOSIT
                                </SelectItem>
                                <SelectItem value="NRE">NRE</SelectItem>
                                <SelectItem value="NRO">NRO</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant="outline"
                              className="font-semibold uppercase tracking-wider text-[10px]"
                            >
                              {acc.type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {acc.currency} {Number(acc.balance).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {editingAccountId === acc.id ? (
                            <Input
                              type="number"
                              value={editInterestRate}
                              onChange={(e) =>
                                setEditInterestRate(e.target.value)
                              }
                              className="h-8 text-xs w-20"
                            />
                          ) : (
                            <span>{acc.interestRate}%</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingAccountId === acc.id ? (
                            <div className="space-y-1">
                              <Input
                                value={editIfsc}
                                onChange={(e) => setEditIfsc(e.target.value)}
                                className="h-8 text-xs w-32"
                              />
                              <Input
                                value={editBranchCode}
                                onChange={(e) =>
                                  setEditBranchCode(e.target.value)
                                }
                                className="h-8 text-xs w-32"
                              />
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-mono">{acc.ifsc}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                Branch: {acc.branchCode}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            onClick={() =>
                              handleToggleStatus(acc.id, acc.status)
                            }
                            variant={
                              acc.status === "ACTIVE"
                                ? "outline"
                                : "destructive"
                            }
                            className={`text-[9px] px-1 py-0 cursor-pointer ${acc.status === "ACTIVE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : ""}`}
                          >
                            {acc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {editingAccountId === acc.id ? (
                              <Button
                                onClick={() => handleSaveEdit(acc.id)}
                                size="icon-sm"
                                variant="outline"
                                className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                              >
                                <Check className="size-4" />
                              </Button>
                            ) : (
                              <Button
                                onClick={() => startEditAccount(acc)}
                                size="icon-sm"
                                variant="ghost"
                              >
                                <Edit2 className="size-4" />
                              </Button>
                            )}
                            <Button
                              onClick={() => handleDeleteAccount(acc.id)}
                              size="icon-sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provision New Account Form */}
        <Card className="border-border/60 bg-card/65 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Provision New Banking Account</CardTitle>
            <CardDescription>
              Manually create a new bank account line for a customer record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateAccount}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div className="space-y-1">
                <Label htmlFor="customer-id">Customer ID (UUID)</Label>
                <Input
                  id="customer-id"
                  placeholder="e.g. e2a1b3c4-..."
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="prod-type">Account Type</Label>
                <Select onValueChange={setType} value={type}>
                  <SelectTrigger id="prod-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAVINGS">SAVINGS</SelectItem>
                    <SelectItem value="CURRENT">CURRENT</SelectItem>
                    <SelectItem value="SALARY">SALARY</SelectItem>
                    <SelectItem value="FIXED_DEPOSIT">FIXED DEPOSIT</SelectItem>
                    <SelectItem value="RECURRING_DEPOSIT">
                      RECURRING DEPOSIT
                    </SelectItem>
                    <SelectItem value="NRE">NRE</SelectItem>
                    <SelectItem value="NRO">NRO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="balance-val">Initial Balance (INR)</Label>
                <Input
                  id="balance-val"
                  type="number"
                  placeholder="e.g. 50000"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rate-val">Interest Rate (%)</Label>
                <Input
                  id="rate-val"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 4.5"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ifsc-code">IFSC Code</Label>
                <Input
                  id="ifsc-code"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="branch-code">Branch Code</Label>
                <Input
                  id="branch-code"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="col-span-full bg-primary font-medium mt-2"
                disabled={actionLoading}
              >
                {actionLoading ? "Provisioning..." : "Provision Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
