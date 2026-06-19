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
  Download,
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
  createdAt: string;
};

type Beneficiary = {
  id: string;
  nickname: string;
  accountNumber: string;
  bankName: string;
  ifsc: string;
  verified: boolean;
  active: boolean;
};

export default function AccountsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [beneficiaries, setBeneficiaries] = React.useState<Beneficiary[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(true);
  const [beneficiariesLoading, setBeneficiariesLoading] = React.useState(true);

  // Apply Account form state
  const [newAccountType, setNewAccountType] = React.useState("SAVINGS");
  const [initialBalance, setInitialBalance] = React.useState("");
  const [newAccountError, setNewAccountError] = React.useState("");
  const [newAccountSuccess, setNewAccountSuccess] = React.useState("");
  const [createAccountLoading, setCreateAccountLoading] = React.useState(false);

  // Beneficiary form state
  const [nickname, setNickname] = React.useState("");
  const [accNum, setAccNum] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [ifscCode, setIfscCode] = React.useState("");
  const [benError, setBenError] = React.useState("");
  const [benSuccess, setBenSuccess] = React.useState("");
  const [addBenLoading, setAddBenLoading] = React.useState(false);

  // Beneficiary edit state
  const [editingBenId, setEditingBenId] = React.useState<string | null>(null);
  const [editNickname, setEditNickname] = React.useState("");
  const [editAccNum, setEditAccNum] = React.useState("");
  const [editBankName, setEditBankName] = React.useState("");
  const [editIfscCode, setEditIfscCode] = React.useState("");

  // Download statement state
  const [statementLoading, setStatementLoading] = React.useState<string | null>(
    null,
  );

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
    try {
      const data = await apiFetch("/accounts");
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAccountsLoading(false);
    }
  }, [apiFetch]);

  const fetchBeneficiaries = React.useCallback(async () => {
    setBeneficiariesLoading(true);
    try {
      const data = await apiFetch("/beneficiaries");
      setBeneficiaries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setBeneficiariesLoading(false);
    }
  }, [apiFetch]);

  React.useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchBeneficiaries();
    }
  }, [user, fetchAccounts, fetchBeneficiaries]);

  // Apply new account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewAccountError("");
    setNewAccountSuccess("");
    setCreateAccountLoading(true);

    try {
      await apiFetch("/accounts", {
        method: "POST",
        body: JSON.stringify({
          customerId: user?.id,
          type: newAccountType,
          balance: initialBalance ? Number(initialBalance) : 0,
          interestRate:
            newAccountType === "SAVINGS"
              ? 3.5
              : newAccountType === "FIXED_DEPOSIT"
                ? 6.5
                : 0.0,
        }),
      });

      setNewAccountSuccess(
        `Your new ${newAccountType.replace("_", " ")} account has been created successfully!`,
      );
      setInitialBalance("");
      fetchAccounts();
    } catch (error: unknown) {
      setNewAccountError(getErrorMessage(error, "Failed to open account."));
    } finally {
      setCreateAccountLoading(false);
    }
  };

  // Add beneficiary
  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setBenError("");
    setBenSuccess("");
    setAddBenLoading(true);

    try {
      await apiFetch("/beneficiaries", {
        method: "POST",
        body: JSON.stringify({
          nickname,
          accountNumber: accNum,
          bankName,
          ifsc: ifscCode,
        }),
      });

      setBenSuccess("Beneficiary added successfully!");
      setNickname("");
      setAccNum("");
      setBankName("");
      setIfscCode("");
      fetchBeneficiaries();
    } catch (error: unknown) {
      setBenError(getErrorMessage(error, "Failed to add beneficiary."));
    } finally {
      setAddBenLoading(false);
    }
  };

  // Toggle beneficiary active status
  const handleToggleBenStatus = async (id: string, currentActive: boolean) => {
    try {
      await apiFetch(`/beneficiaries/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ active: !currentActive }),
      });
      fetchBeneficiaries();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete beneficiary
  const handleDeleteBeneficiary = async (id: string) => {
    if (!confirm("Are you sure you want to remove this beneficiary?")) return;
    try {
      await apiFetch(`/beneficiaries/${id}`, { method: "DELETE" });
      fetchBeneficiaries();
    } catch (err) {
      console.error(err);
    }
  };

  // Start edit beneficiary
  const startEditBen = (b: Beneficiary) => {
    setEditingBenId(b.id);
    setEditNickname(b.nickname);
    setEditAccNum(b.accountNumber);
    setEditBankName(b.bankName);
    setEditIfscCode(b.ifsc);
  };

  // Save edit beneficiary
  const handleSaveEditBeneficiary = async (id: string) => {
    try {
      await apiFetch(`/beneficiaries/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          nickname: editNickname,
          accountNumber: editAccNum,
          bankName: editBankName,
          ifsc: editIfscCode,
        }),
      });
      setEditingBenId(null);
      fetchBeneficiaries();
    } catch (err) {
      console.error(err);
    }
  };

  // Statement download handler
  const handleDownloadStatement = async (
    accountId: string,
    accountNumber: string,
  ) => {
    setStatementLoading(accountId);
    try {
      const { downloadUrl } = await apiFetch(
        `/accounts/${accountId}/statement`,
      );

      // Dynamic client-side download trigger
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `${accountNumber}-statement.txt`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to download statement."));
    } finally {
      setStatementLoading(null);
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
              {publicEnv.NEXT_PUBLIC_APP_NAME}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Customer Hub
            </p>
          </div>

          <nav className="flex items-center gap-4 ml-6">
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/accounts"
              className="text-sm font-semibold text-primary transition-colors"
            >
              Accounts & Beneficiaries
            </Link>
            <Link
              href="/cards"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Card Management
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
              <Badge className="bg-emerald-500">Secure Core Link</Badge>
              <Badge variant="outline">
                Client ID: {user.id.slice(0, 8).toUpperCase()}
              </Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Account Management Center
            </h2>
          </div>
        </section>

        {/* Dynamic Accounts Summary list */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accountsLoading ? (
            <div className="col-span-full py-10 text-center text-sm animate-pulse text-muted-foreground">
              Retrieving account registry from core databases...
            </div>
          ) : accounts.length === 0 ? (
            <div className="col-span-full py-8 text-center border rounded-lg bg-card/40">
              <p className="text-sm text-muted-foreground">
                No active bank accounts found.
              </p>
            </div>
          ) : (
            accounts.map((acc) => (
              <Card
                key={acc.id}
                className="border-border/60 bg-card/65 backdrop-blur-sm shadow hover:shadow-md transition-all"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground tracking-wider uppercase">
                      {acc.type.replace("_", " ")}
                    </span>
                    <Badge
                      variant={
                        acc.status === "ACTIVE" ? "outline" : "destructive"
                      }
                      className={
                        acc.status === "ACTIVE"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {acc.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-mono pt-1">
                    {acc.accountNumber}
                  </CardTitle>
                  <CardDescription className="text-xs pt-0.5">
                    IFSC: {acc.ifsc} | Branch: {acc.branchCode}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">
                      Balance
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      {acc.currency} {Number(acc.balance).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                    <span>Interest Rate</span>
                    <span className="font-semibold text-foreground">
                      {acc.interestRate}% p.a.
                    </span>
                  </div>
                  <Button
                    onClick={() =>
                      handleDownloadStatement(acc.id, acc.accountNumber)
                    }
                    disabled={statementLoading === acc.id}
                    variant="outline"
                    className="w-full text-xs py-1.5 h-auto gap-1"
                  >
                    <Download
                      className={`size-3.5 ${statementLoading === acc.id ? "animate-bounce" : ""}`}
                    />
                    {statementLoading === acc.id
                      ? "Generating..."
                      : "Download Statement"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Action Panel Split: Open Account & Beneficiary Management */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          {/* Apply/Create Account Form */}
          <Card className="border-border/60 bg-card/65 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Open Secondary Account</CardTitle>
              <CardDescription>
                Request a supplementary banking line within our platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {newAccountSuccess && (
                <Alert className="border-emerald-500/25 bg-emerald-500/5 text-emerald-500">
                  <Check className="size-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{newAccountSuccess}</AlertDescription>
                </Alert>
              )}
              {newAccountError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Request Failed</AlertTitle>
                  <AlertDescription>{newAccountError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="account-type">Product Line Type</Label>
                  <Select
                    onValueChange={setNewAccountType}
                    value={newAccountType}
                  >
                    <SelectTrigger id="account-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAVINGS">
                        Savings Account (3.5% Int.)
                      </SelectItem>
                      <SelectItem value="CURRENT">
                        Current Account (No Interest)
                      </SelectItem>
                      <SelectItem value="SALARY">
                        Salary Account (Corporate)
                      </SelectItem>
                      <SelectItem value="FIXED_DEPOSIT">
                        Fixed Deposit (6.5% Int.)
                      </SelectItem>
                      <SelectItem value="RECURRING_DEPOSIT">
                        Recurring Deposit (5.8% Int.)
                      </SelectItem>
                      <SelectItem value="NRE">
                        NRE Account (Non-Resident External)
                      </SelectItem>
                      <SelectItem value="NRO">
                        NRO Account (Non-Resident Ordinary)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="balance">Initial Opening Deposit (INR)</Label>
                  <Input
                    id="balance"
                    type="number"
                    placeholder="e.g. 10000"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary font-medium"
                  disabled={createAccountLoading}
                >
                  {createAccountLoading
                    ? "Provisioning..."
                    : "Submit Application"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Beneficiary Management */}
          <Card className="border-border/60 bg-card/65 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Transfer Beneficiaries</CardTitle>
              <CardDescription>
                Configure external payees for simulated transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Beneficiary Form */}
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Register New Payee
                </h3>

                {benSuccess && (
                  <Alert className="border-emerald-500/25 bg-emerald-500/5 text-emerald-500 py-2">
                    <Check className="size-4" />
                    <AlertDescription className="text-xs">
                      {benSuccess}
                    </AlertDescription>
                  </Alert>
                )}
                {benError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs">
                      {benError}
                    </AlertDescription>
                  </Alert>
                )}

                <form
                  onSubmit={handleAddBeneficiary}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <div className="space-y-1">
                    <Label htmlFor="ben-nickname" className="text-xs">
                      Nickname
                    </Label>
                    <Input
                      id="ben-nickname"
                      placeholder="e.g. Mom"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ben-number" className="text-xs">
                      Account Number / UPI ID
                    </Label>
                    <Input
                      id="ben-number"
                      placeholder="ACC-98765432"
                      value={accNum}
                      onChange={(e) => setAccNum(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ben-bank" className="text-xs">
                      Bank Name
                    </Label>
                    <Input
                      id="ben-bank"
                      placeholder="e.g. State Bank of India"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ben-ifsc" className="text-xs">
                      Bank IFSC Code
                    </Label>
                    <Input
                      id="ben-ifsc"
                      placeholder="SBIN0001234"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="col-span-full bg-primary text-xs mt-2"
                    disabled={addBenLoading}
                  >
                    <Plus className="size-3.5 mr-1" /> Register Payee
                  </Button>
                </form>
              </div>

              {/* Beneficiary Registry Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Registered Payees
                </h3>
                {beneficiariesLoading ? (
                  <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">
                    Syncing beneficiary matrix...
                  </div>
                ) : beneficiaries.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No registered payees.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Payee</TableHead>
                          <TableHead className="text-xs">
                            Account Details
                          </TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {beneficiaries.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell>
                              {editingBenId === b.id ? (
                                <Input
                                  value={editNickname}
                                  onChange={(e) =>
                                    setEditNickname(e.target.value)
                                  }
                                  className="h-7 text-xs w-28"
                                />
                              ) : (
                                <div>
                                  <p className="font-semibold text-xs text-foreground">
                                    {b.nickname}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {b.bankName}
                                  </p>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingBenId === b.id ? (
                                <div className="space-y-1">
                                  <Input
                                    value={editAccNum}
                                    onChange={(e) =>
                                      setEditAccNum(e.target.value)
                                    }
                                    className="h-7 text-xs w-32"
                                  />
                                  <Input
                                    value={editIfscCode}
                                    onChange={(e) =>
                                      setEditIfscCode(e.target.value)
                                    }
                                    className="h-7 text-xs w-32"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <p className="font-mono text-xs text-foreground">
                                    {b.accountNumber}
                                  </p>
                                  <p className="font-mono text-[9px] text-muted-foreground">
                                    IFSC: {b.ifsc}
                                  </p>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                onClick={() =>
                                  handleToggleBenStatus(b.id, b.active)
                                }
                                variant={b.active ? "outline" : "destructive"}
                                className={`text-[9px] px-1 py-0 cursor-pointer ${b.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : ""}`}
                              >
                                {b.active ? "ACTIVE" : "INACTIVE"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {editingBenId === b.id ? (
                                  <Button
                                    onClick={() =>
                                      handleSaveEditBeneficiary(b.id)
                                    }
                                    size="icon-sm"
                                    variant="outline"
                                    className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                  >
                                    <Check className="size-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => startEditBen(b)}
                                    size="icon-sm"
                                    variant="ghost"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleDeleteBeneficiary(b.id)}
                                  size="icon-sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />
        <footer className="text-xs text-muted-foreground flex justify-between items-center py-2">
          <p>API Endpoint: {publicEnv.NEXT_PUBLIC_API_BASE_URL}</p>
          <p>WebSocket URL: {publicEnv.NEXT_PUBLIC_SOCKET_URL}</p>
        </footer>
      </div>
    </main>
  );
}
