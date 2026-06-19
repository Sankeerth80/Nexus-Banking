"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  Landmark,
  LogOut,
  Check,
  RefreshCw,
  Search,
  AlertCircle,
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
import { publicEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";

type CardModel = {
  id: string;
  type: "DEBIT" | "CREDIT";
  cardNumber: string;
  maskedNumber: string;
  expiryDate: string;
  cvv: string;
  status:
    | "ACTIVE"
    | "INACTIVE"
    | "BLOCKED"
    | "FROZEN"
    | "REPLACEMENT_REQUESTED";
  dailyLimit: string;
  creditLimit: string | null;
  balance: string | null;
  customerId: string;
  createdAt: string;
  customer: {
    fullName: string;
    email: string;
  };
};

export default function AdminCardsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [cards, setCards] = React.useState<CardModel[]>([]);
  const [cardsLoading, setCardsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

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

  const fetchCards = React.useCallback(async () => {
    setCardsLoading(true);
    setError("");
    try {
      const data = await apiFetch("/cards/admin");
      setCards(data);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to retrieve bank cards ledger."));
    } finally {
      setCardsLoading(false);
    }
  }, [apiFetch]);

  React.useEffect(() => {
    if (user) {
      fetchCards();
    }
  }, [user, fetchCards]);

  const handleApproveCard = async (id: string) => {
    setSuccess("");
    setError("");
    setActionLoading(true);
    try {
      await apiFetch(`/cards/${id}/admin-approve`, { method: "POST" });
      setSuccess("Applied credit card approved and activated successfully!");
      fetchCards();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to approve card"));
    } finally {
      setActionLoading(false);
    }
  };

  // Filter cards by search query (customer name, email, or card number)
  const filteredCards = cards.filter((c) => {
    const query = searchQuery.toLowerCase();
    return (
      c.customer?.fullName.toLowerCase().includes(query) ||
      c.customer?.email.toLowerCase().includes(query) ||
      c.cardNumber.toLowerCase().includes(query) ||
      c.maskedNumber.toLowerCase().includes(query)
    );
  });

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
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Account Controls
            </Link>
            <Link
              href="/cards"
              className="text-sm font-semibold text-primary transition-colors"
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

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:py-6 animate-fade-in-up">
        {/* Title */}
        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary">Security Admin</Badge>
              <Badge variant="outline">Maker-Checker Approvals</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Master Card Registry
            </h2>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchCards}
              variant="outline"
              className="gap-1.5 text-xs"
            >
              <RefreshCw
                className={`size-3.5 ${cardsLoading ? "animate-spin" : ""}`}
              />{" "}
              Refresh Registry
            </Button>
          </div>
        </section>

        {/* Alerts */}
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

        {/* Registry Card */}
        <Card className="border-border/60 bg-card/65 backdrop-blur-md">
          <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Bank-Wide Card Registry</CardTitle>
              <CardDescription>
                Comprehensive ledger of all customer Debit and Credit products
                provisioned in the platform.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 max-w-xs w-full">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search by name, email or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {cardsLoading ? (
              <div className="text-center py-12 text-sm text-muted-foreground animate-pulse">
                Fetching card matrix from secure database vaults...
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                No cards match your query or none are registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Card Product</TableHead>
                      <TableHead>Card Number</TableHead>
                      <TableHead>Balance / Limit</TableHead>
                      <TableHead>Usage Settings</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCards.map((c) => {
                      const isCredit = c.type === "CREDIT";
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-xs text-foreground">
                                {c.customer?.fullName}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {c.customer?.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-bold text-[9px] uppercase tracking-wider"
                            >
                              {c.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {c.maskedNumber}
                            <span className="block text-[9px] text-muted-foreground font-mono">
                              Expires: {c.expiryDate}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {isCredit ? (
                              <div>
                                <p className="font-semibold text-primary">
                                  O/S: INR {Number(c.balance).toLocaleString()}
                                </p>
                                <p className="text-[9px] text-muted-foreground">
                                  Limit: INR{" "}
                                  {Number(c.creditLimit).toLocaleString()}
                                </p>
                              </div>
                            ) : (
                              <span>N/A (Linked Debit)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="text-[9px] text-muted-foreground font-mono block">
                              Daily Spend Cap: INR{" "}
                              {Number(c.dailyLimit).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                c.status === "ACTIVE"
                                  ? "outline"
                                  : c.status === "INACTIVE"
                                    ? "secondary"
                                    : "destructive"
                              }
                              className={`text-[9px] px-1 py-0 uppercase ${c.status === "ACTIVE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : ""}`}
                            >
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1.5 items-center justify-end">
                              {c.status === "INACTIVE" && (
                                <Button
                                  onClick={() => handleApproveCard(c.id)}
                                  size="xs"
                                  className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  disabled={actionLoading}
                                >
                                  Approve Card
                                </Button>
                              )}
                              {c.status === "REPLACEMENT_REQUESTED" && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/30 text-amber-500 text-[10px] py-1"
                                >
                                  Dispatch Pending
                                </Badge>
                              )}
                              {c.status === "ACTIVE" && (
                                <span className="text-[10px] text-muted-foreground italic">
                                  No action required
                                </span>
                              )}
                            </div>
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
      </div>
    </main>
  );
}
