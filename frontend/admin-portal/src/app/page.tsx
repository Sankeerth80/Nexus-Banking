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
  Eye,
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
import { publicEnv } from "@/lib/env";

type PendingKyc = {
  id: string;
  customerId: string;
  idType: string;
  idNumber: string;
  documentStatus: string;
  riskStatus: string;
  complianceStatus: string;
  branchStatus: string;
  createdAt: string;
  customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    status: string;
  };
};

type KycDetails = PendingKyc & {
  idDocUrl: string | null;
  photoUrl: string | null;
  signatureUrl: string | null;
  documentComment: string | null;
  riskComment: string | null;
  complianceComment: string | null;
  branchComment: string | null;
};

export default function AdminDashboard() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [pendingRequests, setPendingRequests] = React.useState<PendingKyc[]>([]);
  const [selectedRequest, setSelectedRequest] = React.useState<KycDetails | null>(null);
  const [queueLoading, setQueueLoading] = React.useState(true);
  const [detailsLoading, setDetailsLoading] = React.useState(false);

  const [reviewComment, setReviewComment] = React.useState("");
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  // Guard routing
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

  // Fetch pending KYC requests
  const fetchQueue = React.useCallback(async () => {
    setQueueLoading(true);
    setError("");
    try {
      const data = await apiFetch("/kyc/pending");
      setPendingRequests(data);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve pending KYC requests.");
    } finally {
      setQueueLoading(false);
    }
  }, [apiFetch]);

  React.useEffect(() => {
    if (user) {
      fetchQueue();
    }
  }, [user, fetchQueue]);

  // Load details for selected request
  const handleSelectRequest = async (customerId: string) => {
    setDetailsLoading(true);
    setError("");
    setSuccess("");
    setReviewComment("");
    try {
      const details = await apiFetch(`/kyc/request/${customerId}`);
      setSelectedRequest(details);
    } catch (err: any) {
      setError(err.message || "Failed to load request details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Submit review
  const handleReviewSubmit = async (status: "APPROVED" | "REJECTED") => {
    if (!selectedRequest) return;
    setReviewLoading(true);
    setError("");
    setSuccess("");

    // Determine current active step
    let step: "DOCUMENT" | "COMPLIANCE" | "RISK" | "BRANCH" = "DOCUMENT";
    if (selectedRequest.documentStatus !== "APPROVED") {
      step = "DOCUMENT";
    } else if (selectedRequest.complianceStatus !== "APPROVED") {
      step = "COMPLIANCE";
    } else if (selectedRequest.riskStatus !== "APPROVED") {
      step = "RISK";
    } else if (selectedRequest.branchStatus !== "APPROVED") {
      step = "BRANCH";
    }

    try {
      const result = await apiFetch("/kyc/review", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedRequest.customerId,
          step,
          status,
          comment: reviewComment,
        }),
      });

      setSuccess(`KYC stage "${step}" has been successfully ${status.toLowerCase()}!`);
      setReviewComment("");
      
      // Refresh current details & main queue
      await handleSelectRequest(selectedRequest.customerId);
      await fetchQueue();
    } catch (err: any) {
      setError(err.message || "Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-background">
        <Landmark className="size-16 animate-pulse text-primary" />
        <p className="text-sm font-semibold tracking-wide text-muted-foreground animate-pulse">
          Connecting to Nexus Admin Console...
        </p>
      </div>
    );
  }

  if (!user) return null;

  // Determine current step for selected request & authorization status
  const getActiveStepInfo = () => {
    if (!selectedRequest) return null;

    let step: "DOCUMENT" | "COMPLIANCE" | "RISK" | "BRANCH" = "DOCUMENT";
    let status = "PENDING";
    let requiredRole = "KYC_OFFICER";
    let stepLabel = "Document Review";

    if (selectedRequest.documentStatus !== "APPROVED") {
      step = "DOCUMENT";
      status = selectedRequest.documentStatus;
      requiredRole = "KYC_OFFICER";
      stepLabel = "Document Verification";
    } else if (selectedRequest.complianceStatus !== "APPROVED") {
      step = "COMPLIANCE";
      status = selectedRequest.complianceStatus;
      requiredRole = "COMPLIANCE_OFFICER";
      stepLabel = "Compliance Screening";
    } else if (selectedRequest.riskStatus !== "APPROVED") {
      step = "RISK";
      status = selectedRequest.riskStatus;
      requiredRole = "RISK_OFFICER";
      stepLabel = "Risk Assessment";
    } else if (selectedRequest.branchStatus !== "APPROVED") {
      step = "BRANCH";
      status = selectedRequest.branchStatus;
      requiredRole = "BRANCH_MANAGER";
      stepLabel = "Branch Manager Approval";
    } else {
      return { completed: true };
    }

    const isAuthorized = user.role === "CEO" || user.role === requiredRole || (step === "DOCUMENT" && user.role === "BRANCH_MANAGER");

    return {
      completed: false,
      step,
      status,
      requiredRole,
      stepLabel,
      isAuthorized,
    };
  };

  const activeStepInfo = getActiveStepInfo();

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
              <Badge variant="secondary" className="text-[9px] py-0 px-1 font-semibold uppercase tracking-wider">
                {user.role}
              </Badge>
            </div>
          </div>

          <nav className="flex items-center gap-4 ml-6">
            <Link href="/" className="text-sm font-semibold text-primary transition-colors">
              KYC Onboarding
            </Link>
            <Link href="/accounts" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Account Controls
            </Link>
            <Link href="/cards" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Card Registry
            </Link>
            <Link href="/audit" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Auditing & Logs
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
              <Badge className="bg-primary hover:bg-primary/95">Ops Workspace</Badge>
              <Badge variant="outline">Maker-Checker System Enabled</Badge>
              <Badge variant="secondary">Direct DB Connection</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              KYC & Onboarding Operations
            </h2>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchQueue} variant="outline" className="gap-1.5 text-xs">
              <RefreshCw className={`size-3.5 ${queueLoading ? "animate-spin" : ""}`} /> Refresh Queue
            </Button>
          </div>
        </section>

        {/* Dashboard Metrics */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Pending Review</CardDescription>
              <CardTitle className="text-2xl text-[var(--chart-2)] font-bold">
                {pendingRequests.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Onboarding queue</Badge>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardDescription>Your Active Role</CardDescription>
              <CardTitle className="text-xl text-primary font-bold truncate">
                {user.role.replace("_", " ")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Authorized reviews</Badge>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardDescription>SLA Target Status</CardDescription>
              <CardTitle className="text-2xl text-emerald-500 font-bold">
                100% SLA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">0 overdue requests</Badge>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardDescription>System Integrity</CardDescription>
              <CardTitle className="text-2xl text-primary font-bold">
                Audited
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Immutable ledger log</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Operation Mismatch</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-emerald-500/25 bg-emerald-500/5 text-emerald-500">
            <Check className="size-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Core Layout Split */}
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1.3fr]">
          {/* Left: Pending Queue list */}
          <Card className="min-h-[20rem]">
            <CardHeader>
              <CardTitle>Onboarding Queue ({pendingRequests.length})</CardTitle>
              <CardDescription>Select a customer request to inspect documents and submit stage feedback.</CardDescription>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="space-y-3 py-10">
                  <div className="h-6 w-full animate-pulse bg-muted rounded" />
                  <div className="h-6 w-full animate-pulse bg-muted rounded" />
                  <div className="h-6 w-full animate-pulse bg-muted rounded" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
                  <BadgeCheck className="size-12 text-primary/30 mb-3" />
                  <p className="text-sm font-semibold">Queue Clear!</p>
                  <p className="text-xs">No pending applications require reviews currently.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Submitted ID</TableHead>
                        <TableHead>Progress Stages</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((req) => {
                        const isSelected = selectedRequest?.customerId === req.customerId;
                        
                        // Count approved stages
                        const approvedStages = [
                          req.documentStatus,
                          req.complianceStatus,
                          req.riskStatus,
                          req.branchStatus,
                        ].filter(s => s === "APPROVED").length;

                        return (
                          <TableRow 
                            key={req.id} 
                            className={`cursor-pointer transition-colors ${isSelected ? "bg-muted/60" : "hover:bg-muted/20"}`}
                            onClick={() => handleSelectRequest(req.customerId)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-semibold text-sm">{req.customer.fullName}</p>
                                <p className="text-xs text-muted-foreground">{req.customer.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs font-mono">{req.idType}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{req.idNumber}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Progress value={(approvedStages / 4) * 100} className="w-16 h-2" />
                                <span className="text-[10px] text-muted-foreground font-bold">{approvedStages}/4</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button size="icon-sm" variant="ghost">
                                <Eye className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Selected KYC request details panel */}
          <Card className="min-h-[20rem]">
            {detailsLoading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Clock className="size-10 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground animate-pulse">Loading files and review history...</p>
              </div>
            ) : !selectedRequest ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground text-center px-4">
                <FileCheck2 className="size-14 text-muted-foreground/30 mb-3 animate-bounce" />
                <h3 className="text-sm font-semibold">Select Application</h3>
                <p className="text-xs max-w-xs mt-1">
                  Choose a customer from the queue to review verification details, preview credentials, and submit maker-checker feedback.
                </p>
              </div>
            ) : (
              <div>
                <CardHeader className="border-b pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{selectedRequest.customer.fullName}</CardTitle>
                      <CardDescription>Customer KYC Request Dossier</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      ID: {selectedRequest.customerId.slice(0, 8).toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                  {/* Customer details info */}
                  <div className="grid grid-cols-2 gap-4 text-xs rounded-lg border bg-muted/20 p-3">
                    <div>
                      <span className="text-muted-foreground block">Email</span>
                      <strong className="text-foreground">{selectedRequest.customer.email}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Phone</span>
                      <strong className="text-foreground">{selectedRequest.customer.phone}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">ID Document Type</span>
                      <strong className="text-foreground font-mono">{selectedRequest.idType}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">ID Document Number</span>
                      <strong className="text-foreground font-mono">{selectedRequest.idNumber}</strong>
                    </div>
                  </div>

                  {/* Maker Checker Sequential Review Stages List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sequential Approval Pipeline</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b pb-2 text-sm">
                        <span className="font-medium flex items-center gap-1.5">1. Document Verification <Badge variant="secondary" className="text-[9px] py-0 px-1 uppercase">KYC_OFFICER</Badge></span>
                        {getStageBadge(selectedRequest.documentStatus)}
                      </div>
                      {selectedRequest.documentComment && (
                        <p className="text-[11px] text-muted-foreground italic pl-3 pb-1">Comment: {selectedRequest.documentComment}</p>
                      )}

                      <div className="flex items-center justify-between border-b pb-2 text-sm">
                        <span className="font-medium flex items-center gap-1.5">2. Compliance Screening <Badge variant="secondary" className="text-[9px] py-0 px-1 uppercase">COMPLIANCE_OFFICER</Badge></span>
                        {getStageBadge(selectedRequest.complianceStatus)}
                      </div>
                      {selectedRequest.complianceComment && (
                        <p className="text-[11px] text-muted-foreground italic pl-3 pb-1">Comment: {selectedRequest.complianceComment}</p>
                      )}

                      <div className="flex items-center justify-between border-b pb-2 text-sm">
                        <span className="font-medium flex items-center gap-1.5">3. Risk Assessment <Badge variant="secondary" className="text-[9px] py-0 px-1 uppercase">RISK_OFFICER</Badge></span>
                        {getStageBadge(selectedRequest.riskStatus)}
                      </div>
                      {selectedRequest.riskComment && (
                        <p className="text-[11px] text-muted-foreground italic pl-3 pb-1">Comment: {selectedRequest.riskComment}</p>
                      )}

                      <div className="flex items-center justify-between pb-1 text-sm">
                        <span className="font-medium flex items-center gap-1.5">4. Branch Approval <Badge variant="secondary" className="text-[9px] py-0 px-1 uppercase">BRANCH_MANAGER</Badge></span>
                        {getStageBadge(selectedRequest.branchStatus)}
                      </div>
                      {selectedRequest.branchComment && (
                        <p className="text-[11px] text-muted-foreground italic pl-3">Comment: {selectedRequest.branchComment}</p>
                      )}
                    </div>
                  </div>

                  {/* Documents Attachments Previews */}
                  <div className="space-y-3 border-t pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Dossier Files</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">ID Proof copy</span>
                        {selectedRequest.idDocUrl ? (
                          <a href={selectedRequest.idDocUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-20 rounded border bg-muted/40 hover:bg-muted/70 transition-all text-primary font-semibold text-xs text-center p-1.5">
                            <FileText className="size-5 mb-1" />
                            View ID Copy
                          </a>
                        ) : (
                          <div className="flex items-center justify-center h-20 rounded border bg-muted/20 text-muted-foreground text-[10px]">No File</div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">Profile Photo</span>
                        {selectedRequest.photoUrl ? (
                          <a href={selectedRequest.photoUrl} target="_blank" rel="noopener noreferrer" className="block border rounded h-20 overflow-hidden bg-muted/30 hover:opacity-85 transition-all">
                            <img src={selectedRequest.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div className="flex items-center justify-center h-20 rounded border bg-muted/20 text-muted-foreground text-[10px]">No File</div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">Signature Card</span>
                        {selectedRequest.signatureUrl ? (
                          <a href={selectedRequest.signatureUrl} target="_blank" rel="noopener noreferrer" className="block border rounded h-20 overflow-hidden bg-muted/30 hover:opacity-85 transition-all">
                            <img src={selectedRequest.signatureUrl} alt="Signature" className="w-full h-full object-contain p-1" />
                          </a>
                        ) : (
                          <div className="flex items-center justify-center h-20 rounded border bg-muted/20 text-muted-foreground text-[10px]">No File</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Review Actions Panel */}
                  <div className="border-t pt-4 space-y-4">
                    {activeStepInfo?.completed ? (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 text-emerald-500 p-3 text-sm">
                        <CheckCircle2 className="size-5 shrink-0" />
                        <div>
                          <p className="font-semibold">All Steps Completed</p>
                          <p className="text-xs">This account has been activated and savings account provisioned.</p>
                        </div>
                      </div>
                    ) : activeStepInfo ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-primary">Pending Approval Step</h5>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{activeStepInfo.stepLabel}</span>
                            <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-500 font-semibold animate-pulse">Active Review</Badge>
                          </div>
                          
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>Required Reviewer Role: <strong className="text-foreground uppercase">{activeStepInfo.requiredRole}</strong> (or CEO)</p>
                            <p>Current Employee Role: <strong className="text-foreground uppercase">{user.role}</strong></p>
                          </div>

                          {activeStepInfo.isAuthorized ? (
                            <div className="text-emerald-500 text-xs font-semibold flex items-center gap-1">
                              <BadgeCheck className="size-4" /> You are authorized to review this step.
                            </div>
                          ) : (
                            <div className="text-destructive text-xs font-semibold flex items-center gap-1">
                              <ShieldAlert className="size-4" /> Your active role is not authorized for this step.
                            </div>
                          )}
                        </div>

                        {activeStepInfo.isAuthorized && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="comment" className="text-xs font-semibold">Review Comments</Label>
                              <Input
                                id="comment"
                                placeholder="Write decision rationale or remarks here..."
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleReviewSubmit("APPROVED")}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                disabled={reviewLoading}
                              >
                                {reviewLoading ? "Submitting..." : `Approve ${activeStepInfo.step}`}
                              </Button>
                              <Button 
                                onClick={() => handleReviewSubmit("REJECTED")}
                                variant="destructive"
                                className="flex-1 font-medium"
                                disabled={reviewLoading}
                              >
                                {reviewLoading ? "Submitting..." : "Reject Application"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </div>
            )}
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
