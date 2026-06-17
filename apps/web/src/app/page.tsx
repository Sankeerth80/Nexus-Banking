import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  CalendarClock,
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
} from "lucide-react";
import { AdminLoginGate } from "@/components/admin-login-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Progress } from "@/components/ui/progress";
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
import { publicEnv } from "@/lib/env";

type ModuleItem = {
  label: string;
  icon: LucideIcon;
  status: string;
};

type Metric = {
  label: string;
  value: string;
  delta: string;
  tone: "primary" | "accent" | "risk";
};

const userModules: ModuleItem[] = [
  { label: "Dashboard", icon: Gauge, status: "Live" },
  { label: "Accounts", icon: Landmark, status: "4 active" },
  { label: "Transfers", icon: ArrowRightLeft, status: "7 rails" },
  { label: "Beneficiaries", icon: Users, status: "18 trusted" },
  { label: "Debit Cards", icon: CreditCard, status: "2 cards" },
  { label: "Credit Cards", icon: Banknote, status: "1 card" },
  { label: "Statements", icon: FileText, status: "MinIO" },
  { label: "Notifications", icon: Bell, status: "Socket.IO" },
  { label: "Support", icon: LifeBuoy, status: "Priority" },
  { label: "Profile", icon: UserCheck, status: "Verified" },
  { label: "Security", icon: LockKeyhole, status: "2FA" },
];

const adminModules: ModuleItem[] = [
  { label: "Dashboard", icon: Gauge, status: "Live" },
  { label: "Customers", icon: Users, status: "42,810" },
  { label: "Employees", icon: UserCheck, status: "13 roles" },
  { label: "Branches", icon: Building2, status: "128" },
  { label: "KYC", icon: FileCheck2, status: "84 pending" },
  { label: "Cards", icon: CreditCard, status: "Watchlist" },
  { label: "Fraud", icon: ShieldAlert, status: "12 cases" },
  { label: "Risk", icon: Gauge, status: "Moderate" },
  { label: "Compliance", icon: BadgeCheck, status: "Clean" },
  { label: "Audit", icon: FileText, status: "Immutable" },
  { label: "Reports", icon: Banknote, status: "Daily" },
  { label: "Support", icon: Headphones, status: "31 open" },
  { label: "Settings", icon: Settings, status: "Governed" },
];

const userMetrics: Metric[] = [
  { label: "Total Relationship Value", value: "INR 18.42L", delta: "+2.8%", tone: "primary" },
  { label: "Available Balance", value: "INR 6.70L", delta: "4 accounts", tone: "accent" },
  { label: "Card Exposure", value: "INR 1.25L", delta: "38% used", tone: "risk" },
  { label: "Security Score", value: "96/100", delta: "2FA active", tone: "primary" },
];

const adminMetrics: Metric[] = [
  { label: "Daily Transaction Value", value: "INR 14.8Cr", delta: "simulated", tone: "primary" },
  { label: "KYC Queue", value: "84", delta: "18 priority", tone: "accent" },
  { label: "Fraud Alerts", value: "12", delta: "4 high risk", tone: "risk" },
  { label: "SLA Health", value: "98.7%", delta: "within target", tone: "primary" },
];

const transferTypes = [
  "Own Account",
  "Internal Transfer",
  "NEFT Simulation",
  "RTGS Simulation",
  "IMPS Simulation",
  "UPI Simulation",
  "Scheduled Transfer",
];

const cardControls = [
  "Block",
  "Unblock",
  "Freeze",
  "Unfreeze",
  "Replace",
  "Set PIN",
  "Change PIN",
  "Manage Limits",
  "ATM",
  "Online",
  "Contactless",
  "International",
];

const approvalFlow = [
  "Customer",
  "KYC Officer",
  "Compliance Officer",
  "Risk Officer",
  "Branch Manager",
  "Approved",
];

const employeeRoles = [
  "CEO",
  "Branch Manager",
  "Assistant Manager",
  "Relationship Manager",
  "KYC Officer",
  "Compliance Officer",
  "Risk Officer",
  "Loan Officer",
  "Treasury Officer",
  "Finance Officer",
  "Auditor",
  "Support Officer",
  "IT Administrator",
  "Security Administrator",
];

const recentTransfers = [
  ["TRF-24098", "Own Account", "INR 75,000", "Completed"],
  ["TRF-24099", "NEFT Simulation", "INR 1,24,500", "Scheduled"],
  ["TRF-24100", "UPI Simulation", "INR 14,200", "Risk review"],
];

const reviewQueue = [
  ["CUST-01942", "KYC Officer", "Address proof mismatch", "Priority"],
  ["CUST-02018", "Compliance Officer", "PEP screening", "Review"],
  ["CUST-02044", "Risk Officer", "Velocity anomaly", "Escalated"],
];

const toneClass: Record<Metric["tone"], string> = {
  primary: "text-primary",
  accent: "text-[var(--chart-2)]",
  risk: "text-destructive",
};

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} size="sm">
          <CardHeader>
            <CardDescription>{metric.label}</CardDescription>
            <CardTitle className={`text-2xl ${toneClass[metric.tone]}`}>
              {metric.value}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{metric.delta}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ModuleGrid({ modules }: { modules: ModuleItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modules.map((module) => {
        const Icon = module.icon;

        return (
          <Card key={module.label} size="sm">
            <CardContent className="flex min-h-16 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{module.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{module.status}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`${module.label} actions`}>
                <Menu />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TransferTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Command Center</CardTitle>
        <CardDescription>Simulation-only payment workflows</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {transferTypes.map((transferType) => (
            <Badge key={transferType} variant="outline">
              {transferType}
            </Badge>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTransfers.map(([reference, type, amount, status]) => (
              <TableRow key={reference}>
                <TableCell className="font-mono text-xs">{reference}</TableCell>
                <TableCell>{type}</TableCell>
                <TableCell>{amount}</TableCell>
                <TableCell>
                  <Badge variant={status === "Risk review" ? "destructive" : "secondary"}>
                    {status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CardOperations() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Controls</CardTitle>
        <CardDescription>Debit and credit card lifecycle operations</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {cardControls.map((control) => (
          <Button key={control} variant="outline" className="justify-start">
            <CreditCard />
            {control}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function ApprovalWorkflow() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Approval Flow</CardTitle>
        <CardDescription>Sequential maker-checker governance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {approvalFlow.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-3 rounded-md border bg-background p-3"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="text-sm font-medium">{step}</span>
            </div>
          ))}
        </div>
        <Progress value={68} aria-label="Approval queue progress" />
      </CardContent>
    </Card>
  );
}

function ReviewQueue() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk And Compliance Queue</CardTitle>
        <CardDescription>Customer onboarding review stream</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviewQueue.map(([customer, owner, signal, status]) => (
              <TableRow key={customer}>
                <TableCell className="font-mono text-xs">{customer}</TableCell>
                <TableCell>{owner}</TableCell>
                <TableCell>{signal}</TableCell>
                <TableCell>
                  <Badge variant={status === "Escalated" ? "destructive" : "secondary"}>
                    {status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EmployeeRoleCloud() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Roles</CardTitle>
        <CardDescription>Master admin authorization matrix</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {employeeRoles.map((role) => (
          <Badge key={role} variant="outline">
            {role}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function SecurityPanel() {
  const controls = [
    ["2FA", Fingerprint],
    ["OTP", Smartphone],
    ["Trusted Devices", ShieldCheck],
    ["Rate Limits", Gauge],
    ["Session Timeout", CalendarClock],
    ["Audit Logging", FileText],
  ] satisfies Array<[string, LucideIcon]>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Posture</CardTitle>
        <CardDescription>Controls active in the demo architecture</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {controls.map(([label, Icon]) => (
          <div key={label} className="flex items-center gap-3 rounded-md border p-3">
            <Icon className="size-4 text-primary" aria-hidden />
            <span className="text-sm font-medium">{label}</span>
            <CheckCircle2 className="ml-auto size-4 text-primary" aria-hidden />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)]">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Landmark className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal">
              {publicEnv.NEXT_PUBLIC_APP_NAME}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Portfolio banking platform
            </p>
          </div>
          <div className="ml-auto hidden min-w-64 items-center gap-2 md:flex">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <Input aria-label="Search banking workspace" placeholder="Search workspace" />
          </div>
          <ThemeToggle />
          <Avatar className="size-9">
            <AvatarFallback>HB</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:py-6">
        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>Demo environment</Badge>
              <Badge variant="outline">No live banking rails</Badge>
              <Badge variant="secondary">Vercel frontend</Badge>
              <Badge variant="secondary">Render backend</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Enterprise net banking operations
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Bell />
              Alerts
            </Button>
            <Button>
              <ShieldCheck />
              Open Security
            </Button>
          </div>
        </section>

        <Tabs defaultValue="user" className="gap-4">
          <TabsList className="grid w-full grid-cols-2 sm:w-fit">
            <TabsTrigger value="user">
              <Landmark />
              User Portal
            </TabsTrigger>
            <TabsTrigger value="admin">
              <ShieldCheck />
              Master Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="space-y-4">
            <MetricGrid metrics={userMetrics} />
            <ModuleGrid modules={userModules} />
            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
              <TransferTable />
              <CardOperations />
            </div>
            <SecurityPanel />
          </TabsContent>

          <TabsContent value="admin" className="space-y-4">
            <AdminLoginGate>
              <MetricGrid metrics={adminMetrics} />
              <ModuleGrid modules={adminModules} />
              <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <ApprovalWorkflow />
                <ReviewQueue />
              </div>
              <EmployeeRoleCloud />
            </AdminLoginGate>
          </TabsContent>
        </Tabs>

        <Separator />
        <p className="text-xs text-muted-foreground">
          API: {publicEnv.NEXT_PUBLIC_API_BASE_URL} | Realtime:{" "}
          {publicEnv.NEXT_PUBLIC_SOCKET_URL}
        </p>
      </div>
    </main>
  );
}
