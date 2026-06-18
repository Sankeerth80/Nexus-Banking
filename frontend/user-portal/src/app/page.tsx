"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightLeft,
  BadgeCheck,
  Bell,
  Building,
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
  LogOut,
  Mail,
  Menu,
  Plus,
  RefreshCw,
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
  Download,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publicEnv } from "@/lib/env";
import { io, Socket } from "socket.io-client";

type dbTransfer = {
  id: string;
  reference: string;
  type: string;
  amount: string;
  status: string;
  recipientDetails: string | null;
  createdAt: string;
  sourceAccount?: { accountNumber: string };
  destinationAccount?: { accountNumber: string };
};

export default function Home() {
  const { user, loading, logout, verifyEmail, resendEmailVerification, refreshUser } = useAuth();
  const router = useRouter();

  // Email verification inputs
  const [emailCode, setEmailCode] = React.useState("");
  const [emailVerifying, setEmailVerifying] = React.useState(false);
  const [emailError, setEmailError] = React.useState("");
  const [emailSent, setEmailSent] = React.useState(false);

  // Dynamic Workspace states
  const [customerAccounts, setCustomerAccounts] = React.useState<any[]>([]);
  const [customerBeneficiaries, setCustomerBeneficiaries] = React.useState<any[]>([]);
  const [dbTransfers, setDbTransfers] = React.useState<dbTransfer[]>([]);

  // Demo balance modification (deposits)
  const [depositAmount, setDepositAmount] = React.useState("");
  const [depositSuccess, setDepositSuccess] = React.useState("");
  const [depositLoading, setDepositLoading] = React.useState(false);

  // Socket.io alerts
  const [notifications, setNotifications] = React.useState<string[]>([]);
  const [socket, setSocket] = React.useState<Socket | null>(null);

  // Transfer Wizard States
  const [wizardStep, setWizardStep] = React.useState<"beneficiary" | "review" | "2fa" | "otp" | "receipt">("beneficiary");
  const [sourceAccountId, setSourceAccountId] = React.useState("");
  const [targetType, setTargetType] = React.useState<"beneficiary" | "own" | "other">("beneficiary");
  const [beneficiaryId, setBeneficiaryId] = React.useState("");
  const [destAccountId, setDestAccountId] = React.useState("");
  const [otherRecipient, setOtherRecipient] = React.useState("");
  const [transferAmount, setTransferAmount] = React.useState("");
  const [transferType, setTransferType] = React.useState("IMPS_SIMULATION");
  const [scheduledDate, setScheduledDate] = React.useState("");

  // OTP/2FA input states
  const [otpCodeInput, setOtpCodeInput] = React.useState("");
  const [totpCodeInput, setTotpCodeInput] = React.useState("");
  const [activeTransferId, setActiveTransferId] = React.useState("");
  const [activeTransferRef, setActiveTransferRef] = React.useState("");
  const [activeTransferSandboxCode, setActiveTransferSandboxCode] = React.useState("");
  const [activeTransferNeeds2fa, setActiveTransferNeeds2fa] = React.useState(false);

  const [transferLoading, setTransferLoading] = React.useState(false);
  const [transferError, setTransferError] = React.useState("");
  const [transferSuccess, setTransferSuccess] = React.useState("");

  // Route guarding
  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // apiFetch wrapper
  const apiFetch = React.useCallback(async (path: string, options: RequestInit = {}) => {
    const baseUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
    const url = path.startsWith("http") ? path : `${baseUrl}/${path.replace(/^\//, "")}`;
    
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
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }, []);

  // Sync workspace details
  const loadTransferWorkspace = React.useCallback(async () => {
    try {
      const accs = await apiFetch("/accounts");
      setCustomerAccounts(accs);
      
      const bens = await apiFetch("/beneficiaries");
      setCustomerBeneficiaries(bens.filter((b: any) => b.active));

      const hist = await apiFetch("/transfers/history");
      setDbTransfers(hist);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    }
  }, [apiFetch]);

  React.useEffect(() => {
    if (user && user.status === "APPROVED") {
      loadTransferWorkspace();
    }
  }, [user, loadTransferWorkspace]);

  // Connect Socket.io
  React.useEffect(() => {
    if (user && user.status === "APPROVED") {
      const socketUrl = publicEnv.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
      const s = io(socketUrl, {
        transports: ["websocket"],
      });
      setSocket(s);

      s.on("connect", () => {
        setNotifications(prev => ["Connected to Realtime Notification service.", ...prev]);
      });

      s.on("money-transfer", (data: any) => {
        setNotifications(prev => [`[Transfer Event] Ref: ${data.reference} | Amount: ${data.amount} | Status: ${data.status}`, ...prev]);
        loadTransferWorkspace();
        refreshUser();
      });

      return () => {
        s.disconnect();
      };
    }
  }, [user, loadTransferWorkspace, refreshUser]);

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailVerifying(true);

    try {
      await verifyEmail(emailCode);
    } catch (err: any) {
      setEmailError(err.message || "Verification code is invalid or expired.");
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    setEmailError("");
    try {
      await verifyEmail(emailCode);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 5000);
    } catch (err: any) {
      setEmailError(err.message || "Failed to resend verification code.");
    }
  };

  const handleQuickDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositSuccess("");
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) return;
    
    setDepositLoading(true);
    try {
      if (customerAccounts.length > 0) {
        // Find default savings account ID
        const targetAcc = customerAccounts[0];
        
        // Call backend API update status or provision transaction
        await apiFetch(`/accounts/${targetAcc.id}`, {
          method: "PUT",
          body: JSON.stringify({
            // Simply bump balance via edit (sandbox convenience)
            interestRate: Number(targetAcc.interestRate),
          }),
        });

        // Locally bump and submit socket event
        targetAcc.balance = Number(targetAcc.balance) + Number(depositAmount);
        setDepositSuccess(`Successfully deposited INR ${Number(depositAmount).toLocaleString()}!`);
        setDepositAmount("");
        
        if (socket) {
          socket.emit("money-transfer", {
            reference: "DEP-" + Math.floor(Math.random() * 90000 + 10000),
            amount: Number(depositAmount),
            status: "COMPLETED"
          });
        }
      }
    } catch (err: any) {
      console.error("Failed deposit simulation:", err);
    } finally {
      setDepositLoading(false);
    }
  };

  // ==========================================
  // WIZARD: SUBMIT DETAILS -> REVIEW
  // ==========================================
  const handleTransferSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError("");
    setTransferSuccess("");

    if (!sourceAccountId) {
      setTransferError("Please choose a source account.");
      return;
    }

    const amt = Number(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError("Please input a positive transfer amount.");
      return;
    }

    const selectedSource = customerAccounts.find(a => a.id === sourceAccountId);
    if (selectedSource && Number(selectedSource.balance) < amt) {
      setTransferError("Insufficient funds in the selected source account.");
      return;
    }

    // Verify recipient selection
    if (targetType === "beneficiary" && !beneficiaryId) {
      setTransferError("Please select a registered payee.");
      return;
    }
    if (targetType === "own" && !destAccountId) {
      setTransferError("Please select a target own account.");
      return;
    }
    if (targetType === "other" && !otherRecipient) {
      setTransferError("Please specify recipient details.");
      return;
    }

    setWizardStep("review");
  };

  // ==========================================
  // WIZARD: CONFIRM DETAILS -> INITIATE API
  // ==========================================
  const handleInitiateTransfer = async () => {
    setTransferLoading(true);
    setTransferError("");
    
    let destId: string | undefined = undefined;
    let recDetails = "";

    if (targetType === "own") {
      destId = destAccountId;
      const destAcc = customerAccounts.find(a => a.id === destAccountId);
      recDetails = `Own Account: ${destAcc?.accountNumber}`;
    } else if (targetType === "beneficiary") {
      const ben = customerBeneficiaries.find(b => b.id === beneficiaryId);
      recDetails = `Payee: ${ben?.nickname} (${ben?.bankName} - ${ben?.accountNumber})`;
    } else {
      recDetails = `Other Payee: ${otherRecipient}`;
    }

    try {
      const result = await apiFetch("/transfers/initiate", {
        method: "POST",
        body: JSON.stringify({
          sourceAccountId,
          destinationAccountId: destId,
          recipientDetails: recDetails,
          amount: Number(transferAmount),
          type: transferType,
          scheduledFor: transferType === "SCHEDULED" ? scheduledDate : undefined,
        }),
      });

      setActiveTransferId(result.transferId);
      setActiveTransferRef(result.reference);
      setActiveTransferNeeds2fa(result.needs2fa);
      setActiveTransferSandboxCode(result.sandboxOtpCode);

      // Advance wizard
      if (result.needs2fa) {
        setWizardStep("2fa");
      } else {
        setWizardStep("otp");
      }
    } catch (err: any) {
      setTransferError(err.message || "Failed to initialize secure transfer rails.");
    } finally {
      setTransferLoading(false);
    }
  };

  // ==========================================
  // WIZARD: VERIFY 2FA TOTP
  // ==========================================
  const handleVerify2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferLoading(true);
    setTransferError("");

    try {
      await apiFetch(`/transfers/${activeTransferId}/verify-2fa`, {
        method: "POST",
        body: JSON.stringify({ code: totpCodeInput }),
      });
      
      // Advance to OTP step
      setWizardStep("otp");
    } catch (err: any) {
      setTransferError(err.message || "Invalid 2FA authentication token.");
    } finally {
      setTransferLoading(false);
    }
  };

  // ==========================================
  // WIZARD: VERIFY EMAIL OTP
  // ==========================================
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferLoading(true);
    setTransferError("");

    try {
      const result = await apiFetch(`/transfers/${activeTransferId}/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ code: otpCodeInput }),
      });

      setTransferSuccess(`Transaction successfully executed!`);
      setWizardStep("receipt");

      // Reload registry data
      await loadTransferWorkspace();
      await refreshUser();
    } catch (err: any) {
      setTransferError(err.message || "Invalid or expired OTP code.");
    } finally {
      setTransferLoading(false);
    }
  };

  // ==========================================
  // WIZARD: RESET WIZARD
  // ==========================================
  const handleResetWizard = () => {
    setWizardStep("beneficiary");
    setSourceAccountId("");
    setTargetType("beneficiary");
    setBeneficiaryId("");
    setDestAccountId("");
    setOtherRecipient("");
    setTransferAmount("");
    setTransferType("IMPS_SIMULATION");
    setScheduledDate("");
    setOtpCodeInput("");
    setTotpCodeInput("");
    setActiveTransferId("");
    setActiveTransferRef("");
    setActiveTransferSandboxCode("");
    setActiveTransferNeeds2fa(false);
    setTransferError("");
    setTransferSuccess("");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-background">
        <Landmark className="size-16 animate-pulse text-primary" />
        <p className="text-sm font-semibold tracking-wide text-muted-foreground animate-pulse">
          Loading Nexus Banking...
        </p>
      </div>
    );
  }

  if (!user) return null;

  // Render 1: Email Verification Required
  if (!user.emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)] px-4 py-12">
        <Card className="w-full max-w-md border-border/60 bg-card/65 backdrop-blur-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
              <Mail className="size-6" />
            </div>
            <CardTitle>Verify Your Email</CardTitle>
            <CardDescription>
              A 6-digit verification code was sent to <strong className="text-foreground">{user.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{emailError}</AlertDescription>
              </Alert>
            )}

            {emailSent && (
              <Alert className="border-emerald-500/20 bg-emerald-500/5 text-emerald-500">
                <Check className="size-4" />
                <AlertTitle>Sent</AlertTitle>
                <AlertDescription>Verification code resent successfully!</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleEmailVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="123456"
                  maxLength={6}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  className="text-center font-mono text-lg tracking-widest"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-primary font-medium" disabled={emailVerifying}>
                {emailVerifying ? "Verifying..." : "Verify Code"}
              </Button>
            </form>

            <div className="flex items-center justify-between text-xs pt-2">
              <button onClick={handleResendEmail} className="text-primary font-semibold hover:underline">
                Resend Code
              </button>
              <button onClick={logout} className="text-destructive font-semibold hover:underline flex items-center gap-1">
                <LogOut className="size-3" /> Log Out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render 2: KYC Documentation Required
  if (user.status === "DRAFT" || user.status === "KYC_REVIEW") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)] px-4 py-12">
        <Card className="w-full max-w-lg border-border/60 bg-card/65 backdrop-blur-md shadow-2xl p-4">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
              <FileCheck2 className="size-6 animate-bounce" />
            </div>
            <CardTitle>Identity Verification Required</CardTitle>
            <CardDescription>
              To protect your identity and follow banking guidelines, please upload your KYC documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2 text-muted-foreground">
              <p>You will need to provide:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Government ID Proof copy (Aadhaar, PAN, Passport, or License)</li>
                <li>Clear passport-sized profile photo</li>
                <li>Scanned copy of your signature</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => router.push("/kyc")} className="flex-1 bg-primary font-medium">
                Complete KYC Verification
              </Button>
              <Button onClick={logout} variant="outline" className="flex items-center gap-1">
                <LogOut className="size-4" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render 3: KYC Pending Review Stage
  if (
    user.status === "PENDING" ||
    user.status === "COMPLIANCE_REVIEW" ||
    user.status === "RISK_REVIEW" ||
    user.status === "BRANCH_MANAGER_REVIEW"
  ) {
    const kyc = user.kycRequest || {};
    
    const getStageBadge = (status: string) => {
      const displayStatus = status || "PENDING";
      if (displayStatus === "APPROVED") {
        return <Badge variant="outline" className="border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold">{displayStatus}</Badge>;
      }
      if (displayStatus === "REJECTED") {
        return <Badge variant="destructive" className="font-semibold">{displayStatus}</Badge>;
      }
      return <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-500 font-semibold">{displayStatus}</Badge>;
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)] px-4 py-12">
        <Card className="w-full max-w-xl border-border/60 bg-card/65 backdrop-blur-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 mb-2">
              <Clock className="size-6 animate-spin" />
            </div>
            <CardTitle>KYC Application Under Review</CardTitle>
            <CardDescription>
              Our operations and compliance teams are currently reviewing your documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold tracking-wide text-muted-foreground">VERIFICATION PROGRESS</h4>
              
              <div className="space-y-3">
                {/* Stage 1 */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">1. Document Verification</span>
                  </div>
                  {getStageBadge(kyc.documentStatus)}
                </div>
 
                {/* Stage 2 */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">2. Compliance Screening</span>
                  </div>
                  {getStageBadge(kyc.complianceStatus)}
                </div>
 
                {/* Stage 3 */}
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">3. Risk Assessment</span>
                  </div>
                  {getStageBadge(kyc.riskStatus)}
                </div>
 
                {/* Stage 4 */}
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Building className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">4. Branch Approval</span>
                  </div>
                  {getStageBadge(kyc.branchStatus)}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Button onClick={refreshUser} variant="outline" className="flex-1 gap-1">
                <RefreshCw className="size-4" /> Refresh Status
              </Button>
              <Button onClick={logout} variant="ghost" className="text-destructive gap-1">
                <LogOut className="size-4" /> Log Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render 4: Active Approved Dashboard
  const activeAccount = user.accounts?.[0];
  const balance = activeAccount ? Number(activeAccount.balance) : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)]">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Landmark className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal">
              {publicEnv.NEXT_PUBLIC_APP_NAME}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Welcome back, {user.fullName}
            </p>
          </div>

          <nav className="flex items-center gap-4 ml-6">
            <Link href="/" className="text-sm font-semibold text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/accounts" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Accounts & Beneficiaries
            </Link>
            <Link href="/cards" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Card Management
            </Link>
          </nav>

          <div className="ml-auto hidden min-w-64 items-center gap-2 md:flex">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <Input aria-label="Search banking workspace" placeholder="Search accounts, transfers..." />
          </div>
          <ThemeToggle />
          <Button onClick={logout} variant="ghost" size="icon" aria-label="Log out">
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:py-6 animate-fade-in-up">
        {/* Verification banner */}
        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-500 hover:bg-emerald-600">Active Account</Badge>
              <Badge variant="outline">Customer ID: {user.id.slice(0, 8).toUpperCase()}</Badge>
              <Badge variant="secondary">2FA Active</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Simulated Net Banking Dashboard
            </h2>
          </div>
        </section>

        {/* Metrics Section */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Relationship Value</CardDescription>
              <CardTitle className="text-2xl text-primary font-bold">
                INR {balance.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">1 Savings Account</Badge>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardDescription>Available Balance</CardDescription>
              <CardTitle className="text-2xl text-[var(--chart-2)] font-bold">
                INR {balance.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{activeAccount?.accountNumber || "N/A"}</Badge>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardDescription>Demo Environment</CardDescription>
              <CardTitle className="text-2xl text-emerald-500 font-bold">
                Sandbox Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Live metrics active</Badge>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardDescription>Security Score</CardDescription>
              <CardTitle className="text-2xl text-primary font-bold">
                98/100
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Strong credentials</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Actions and Transfer Wizard */}
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            
            {/* Quick Deposit Simulator */}
            <Card>
              <CardHeader>
                <CardTitle>Simulator Quick Deposit</CardTitle>
                <CardDescription>Add mock funds to your savings account in the sandbox.</CardDescription>
              </CardHeader>
              <CardContent>
                {depositSuccess && (
                  <Alert className="mb-4 border-emerald-500/25 bg-emerald-500/5 text-emerald-500">
                    <Check className="size-4" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{depositSuccess}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleQuickDeposit} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="deposit">Deposit Amount (INR)</Label>
                    <Input
                      id="deposit"
                      type="number"
                      placeholder="e.g. 10000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="bg-primary" disabled={depositLoading}>
                    <Plus className="size-4 mr-1" /> Deposit
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Transfer command center (WIZARD FLOW) */}
            <Card>
              <CardHeader>
                <CardTitle>Secure Transfer Engine</CardTitle>
                <CardDescription>Multi-step transfer checkout flow with dynamic checks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {transferError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Checkout Blocked</AlertTitle>
                    <AlertDescription>{transferError}</AlertDescription>
                  </Alert>
                )}

                {/* STEP 1: BENEFICIARY CONFIG */}
                {wizardStep === "beneficiary" && (
                  <form onSubmit={handleTransferSubmitDetails} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="source-acc">Source Debit Account</Label>
                        <Select onValueChange={setSourceAccountId} value={sourceAccountId}>
                          <SelectTrigger id="source-acc">
                            <SelectValue placeholder="Select Source Account" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerAccounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.accountNumber} ({acc.type.replace("_", " ")} - INR {Number(acc.balance).toLocaleString()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="target-type">Recipient Category</Label>
                        <Select onValueChange={(val: any) => setTargetType(val)} value={targetType}>
                          <SelectTrigger id="target-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beneficiary">Registered Beneficiary</SelectItem>
                            <SelectItem value="own">Transfer to Own Account</SelectItem>
                            <SelectItem value="other">One-Time Payee (VPA / Card)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {targetType === "beneficiary" && (
                        <div className="space-y-1">
                          <Label htmlFor="beneficiary">Select Beneficiary</Label>
                          <Select onValueChange={setBeneficiaryId} value={beneficiaryId}>
                            <SelectTrigger id="beneficiary">
                              <SelectValue placeholder="Choose Payee" />
                            </SelectTrigger>
                            <SelectContent>
                              {customerBeneficiaries.map(ben => (
                                <SelectItem key={ben.id} value={ben.id}>
                                  {ben.nickname} ({ben.bankName} - {ben.accountNumber})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {targetType === "own" && (
                        <div className="space-y-1">
                          <Label htmlFor="own-dest">Destination Account</Label>
                          <Select onValueChange={setDestAccountId} value={destAccountId}>
                            <SelectTrigger id="own-dest">
                              <SelectValue placeholder="Choose Target Account" />
                            </SelectTrigger>
                            <SelectContent>
                              {customerAccounts.filter(a => a.id !== sourceAccountId).map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  {acc.accountNumber} ({acc.type.replace("_", " ")})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {targetType === "other" && (
                        <div className="space-y-1">
                          <Label htmlFor="other-details">UPI ID / Account String</Label>
                          <Input 
                            id="other-details" 
                            placeholder="SBIN0001234:ACC-1234567 or upi@nexus" 
                            value={otherRecipient}
                            onChange={(e) => setOtherRecipient(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label htmlFor="transfer-method">Payment Rail Network</Label>
                        <Select onValueChange={setTransferType} value={transferType}>
                          <SelectTrigger id="transfer-method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IMPS_SIMULATION">IMPS (Immediate Transfer)</SelectItem>
                            <SelectItem value="NEFT_SIMULATION">NEFT Simulation</SelectItem>
                            <SelectItem value="RTGS_SIMULATION">RTGS Simulation</SelectItem>
                            <SelectItem value="UPI_SIMULATION">UPI (Instant VPA)</SelectItem>
                            <SelectItem value="OWN_ACCOUNT">Own Account Transfer</SelectItem>
                            <SelectItem value="INTERNAL">Internal Nexus Transfer</SelectItem>
                            <SelectItem value="SCHEDULED">Scheduled Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="amount">Amount (INR)</Label>
                        <Input
                          id="amount"
                          type="number"
                          placeholder="Amount"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          required
                        />
                      </div>

                      {transferType === "SCHEDULED" && (
                        <div className="space-y-1">
                          <Label htmlFor="schedule-time">Execution Date & Time</Label>
                          <Input 
                            id="schedule-time"
                            type="datetime-local" 
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            required
                          />
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full bg-primary font-medium">
                      Proceed to Review
                    </Button>
                  </form>
                )}

                {/* STEP 2: SUMMARY REVIEW */}
                {wizardStep === "review" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-primary">Confirm Transfer Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs border rounded-lg p-3 bg-muted/20">
                      <div>
                        <span className="text-muted-foreground block">Debit Source</span>
                        <strong className="text-foreground">
                          {customerAccounts.find(a => a.id === sourceAccountId)?.accountNumber}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Transfer Method</span>
                        <strong className="text-foreground uppercase">{transferType.replace("_", " ")}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Recipient Payee</span>
                        <strong className="text-foreground">
                          {targetType === "own" 
                            ? customerAccounts.find(a => a.id === destAccountId)?.accountNumber
                            : targetType === "beneficiary"
                            ? customerBeneficiaries.find(b => b.id === beneficiaryId)?.nickname
                            : otherRecipient
                          }
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Amount</span>
                        <strong className="text-primary font-bold">INR {Number(transferAmount).toLocaleString()}</strong>
                      </div>
                      {transferType === "SCHEDULED" && (
                        <div className="col-span-2 border-t pt-2 mt-1">
                          <span className="text-muted-foreground block">Scheduled Execution</span>
                          <strong className="text-foreground font-mono">{new Date(scheduledDate).toLocaleString()}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button onClick={handleInitiateTransfer} className="flex-1 bg-primary" disabled={transferLoading}>
                        {transferLoading ? "Securing rails..." : "Confirm & Send OTP"}
                      </Button>
                      <Button onClick={() => setWizardStep("beneficiary")} variant="outline" className="flex-1">
                        Modify Parameters
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: 2FA TOTP CHALLENGE */}
                {wizardStep === "2fa" && (
                  <form onSubmit={handleVerify2Fa} className="space-y-4">
                    <div className="text-center space-y-1">
                      <Fingerprint className="size-10 text-primary mx-auto animate-pulse" />
                      <h3 className="text-sm font-bold text-foreground">Two-Factor Token Required</h3>
                      <p className="text-xs text-muted-foreground">Please open your Google Authenticator app and input your secure code.</p>
                    </div>

                    <div className="space-y-1 max-w-xs mx-auto">
                      <Label htmlFor="2fa-token" className="sr-only">TOTP Code</Label>
                      <Input
                        id="2fa-token"
                        maxLength={6}
                        placeholder="123456"
                        value={totpCodeInput}
                        onChange={(e) => setTotpCodeInput(e.target.value)}
                        className="text-center font-mono text-lg tracking-widest"
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full bg-primary" disabled={transferLoading}>
                      {transferLoading ? "Verifying..." : "Validate Token"}
                    </Button>
                  </form>
                )}

                {/* STEP 4: EMAIL OTP CHALLENGE */}
                {wizardStep === "otp" && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="text-center space-y-1">
                      <Mail className="size-10 text-primary mx-auto animate-pulse" />
                      <h3 className="text-sm font-bold text-foreground">Email OTP Required</h3>
                      <p className="text-xs text-muted-foreground">We've sent a 6-digit transaction authorization key to your email.</p>
                    </div>

                    {activeTransferSandboxCode && (
                      <Card className="border-border/40 bg-muted/20 p-2.5 max-w-xs mx-auto text-center font-mono text-xs text-primary font-semibold">
                        [Sandbox Hint] Code: {activeTransferSandboxCode}
                      </Card>
                    )}

                    <div className="space-y-1 max-w-xs mx-auto">
                      <Label htmlFor="otp-token" className="sr-only">OTP Code</Label>
                      <Input
                        id="otp-token"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCodeInput}
                        onChange={(e) => setOtpCodeInput(e.target.value)}
                        className="text-center font-mono text-lg tracking-widest"
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full bg-primary" disabled={transferLoading}>
                      {transferLoading ? "Executing transfer..." : "Verify & Complete Transfer"}
                    </Button>
                  </form>
                )}

                {/* STEP 5: RECEIPT PREVIEW */}
                {wizardStep === "receipt" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex flex-col items-center justify-center py-4 border-b text-center space-y-1.5">
                      <CheckCircle2 className="size-12 text-emerald-500" />
                      <h3 className="text-lg font-bold text-foreground">Transaction Completed</h3>
                      <span className="text-xs text-muted-foreground">Reference: <strong className="font-mono text-foreground">{activeTransferRef}</strong></span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs p-3 border rounded-lg bg-card/65">
                      <div>
                        <span className="text-muted-foreground block">Debit Source</span>
                        <strong className="text-foreground font-mono">
                          {customerAccounts.find(a => a.id === sourceAccountId)?.accountNumber}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Transfer Method</span>
                        <strong className="text-foreground uppercase">{transferType.replace("_", " ")}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Recipient details</span>
                        <strong className="text-foreground">
                          {targetType === "own" 
                            ? customerAccounts.find(a => a.id === destAccountId)?.accountNumber
                            : targetType === "beneficiary"
                            ? customerBeneficiaries.find(b => b.id === beneficiaryId)?.nickname
                            : otherRecipient
                          }
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Transaction Status</span>
                        <Badge variant="outline" className="border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold uppercase text-[9px] py-0 px-1.5">
                          {transferType === "SCHEDULED" ? "SCHEDULED" : "COMPLETED"}
                        </Badge>
                      </div>
                      <div className="col-span-2 border-t pt-2 mt-1 flex justify-between items-baseline">
                        <span className="text-muted-foreground">Total Transferred</span>
                        <strong className="text-lg font-bold text-primary">INR {Number(transferAmount).toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleResetWizard} className="flex-1 bg-primary">
                        Return to Command Center
                      </Button>
                      <Button onClick={() => window.print()} variant="outline" className="gap-1.5">
                        <FileText className="size-4" /> Print Receipt
                      </Button>
                    </div>
                  </div>
                )}

                {/* Dynamic Transactions History Table */}
                <div className="pt-2">
                  <h4 className="text-sm font-semibold mb-3">Recent Simulated Transactions</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbTransfers.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                          <TableCell className="text-xs truncate max-w-[10rem]">
                            {t.recipientDetails || (t.destinationAccount ? t.destinationAccount.accountNumber : "External Payee")}
                          </TableCell>
                          <TableCell className="text-xs">{t.type.replace("_", " ")}</TableCell>
                          <TableCell className="font-medium text-xs">INR {Number(t.amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={t.status === "COMPLETED" ? "outline" : t.status === "FAILED" || t.status === "CANCELLED" ? "destructive" : "secondary"} className={t.status === "COMPLETED" ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 text-[10px]" : "text-[10px]"}>
                              {t.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Realtime Alert Feed */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Realtime Audit & Socket Feed</CardTitle>
                  <span className="flex size-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <CardDescription>Live notifications over WebSocket channels.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4 min-h-[14rem] max-h-[18rem] overflow-y-auto space-y-2.5 font-mono text-[11px] leading-relaxed">
                  {notifications.length === 0 ? (
                    <span className="text-muted-foreground block text-center pt-12">Listening for events...</span>
                  ) : (
                    notifications.map((note, index) => (
                      <div key={index} className="border-b border-border/20 pb-1.5 last:border-0 text-foreground">
                        {note}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card controls */}
            <Card>
              <CardHeader>
                <CardTitle>Security & Card Controls</CardTitle>
                <CardDescription>Block or freeze digital debit cards instantly</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="outline" className="justify-start text-xs">
                  <CreditCard className="size-4 mr-2" /> Temporarily Freeze Debit Card
                </Button>
                <Button variant="outline" className="justify-start text-xs text-destructive hover:bg-destructive/5 hover:text-destructive">
                  <ShieldAlert className="size-4 mr-2" /> Report Lost / Permanently Block Card
                </Button>
              </CardContent>
            </Card>
          </div>
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
