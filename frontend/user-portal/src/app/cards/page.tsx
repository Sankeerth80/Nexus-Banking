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
  Plus,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Coins,
  Sparkles,
  DollarSign,
  AlertCircle,
  Clock,
  Sliders,
  FileText,
  FileCheck2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publicEnv } from "@/lib/env";

type Account = {
  id: string;
  accountNumber: string;
  type: string;
  currency: string;
  balance: string;
  status: string;
};

type CardTransaction = {
  id: string;
  amount: string;
  description: string;
  isEmi: boolean;
  emiMonths: number | null;
  emiInterestRate: string | null;
  createdAt: string;
};

type CardModel = {
  id: string;
  type: "DEBIT" | "CREDIT";
  cardNumber: string;
  maskedNumber: string;
  expiryDate: string;
  cvv: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED" | "FROZEN" | "REPLACEMENT_REQUESTED";
  accountId: string | null;
  atmEnabled: boolean;
  onlineEnabled: boolean;
  contactlessEnabled: boolean;
  internationalEnabled: boolean;
  dailyLimit: string;
  atmLimit: string;
  onlineLimit: string;
  contactlessLimit: string;
  internationalLimit: string;
  creditLimit: string | null;
  balance: string | null;
  availableCredit: string | null;
  rewardsPoints: number;
  autoPayEnabled: boolean;
  createdAt: string;
  transactions: CardTransaction[];
};

export default function CardsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [cards, setCards] = React.useState<CardModel[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [cardsLoading, setCardsLoading] = React.useState(true);
  const [accountsLoading, setAccountsLoading] = React.useState(true);
  
  // Selection
  const [selectedCardId, setSelectedCardId] = React.useState<string | null>(null);
  const [revealDetails, setRevealDetails] = React.useState(false);

  // Apply Forms State
  const [debitAccountId, setDebitAccountId] = React.useState("");
  const [creditTier, setCreditTier] = React.useState("CLASSIC");
  const [creditRequestedLimit, setCreditRequestedLimit] = React.useState("");

  // Action status states
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

  // Limit panel states
  const [atmEnabled, setAtmEnabled] = React.useState(true);
  const [onlineEnabled, setOnlineEnabled] = React.useState(true);
  const [contactlessEnabled, setContactlessEnabled] = React.useState(true);
  const [internationalEnabled, setInternationalEnabled] = React.useState(false);
  const [dailyLimit, setDailyLimit] = React.useState("");
  const [atmLimit, setAtmLimit] = React.useState("");
  const [onlineLimit, setOnlineLimit] = React.useState("");
  const [contactlessLimit, setContactlessLimit] = React.useState("");
  const [internationalLimit, setInternationalLimit] = React.useState("");

  // PIN state
  const [newPin, setNewPin] = React.useState("");

  // Bill payment state
  const [payBillAccountId, setPayBillAccountId] = React.useState("");
  const [payBillAmount, setPayBillAmount] = React.useState("");

  // EMI state
  const [emiMonths, setEmiMonths] = React.useState<Record<string, number>>({});

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

  const fetchCards = React.useCallback(async () => {
    setCardsLoading(true);
    try {
      const data = await apiFetch("/cards");
      setCards(data);
      if (data.length > 0 && !selectedCardId) {
        setSelectedCardId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCardsLoading(false);
    }
  }, [apiFetch, selectedCardId]);

  const fetchAccounts = React.useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await apiFetch("/accounts");
      setAccounts(data.filter((a: Account) => a.status === "ACTIVE"));
    } catch (err) {
      console.error(err);
    } finally {
      setAccountsLoading(false);
    }
  }, [apiFetch]);

  React.useEffect(() => {
    if (user) {
      fetchCards();
      fetchAccounts();
    }
  }, [user]);

  // Sync controls when selected card changes
  const selectedCard = cards.find((c) => c.id === selectedCardId);

  React.useEffect(() => {
    if (selectedCard) {
      setAtmEnabled(selectedCard.atmEnabled);
      setOnlineEnabled(selectedCard.onlineEnabled);
      setContactlessEnabled(selectedCard.contactlessEnabled);
      setInternationalEnabled(selectedCard.internationalEnabled);
      setDailyLimit(selectedCard.dailyLimit);
      setAtmLimit(selectedCard.atmLimit);
      setOnlineLimit(selectedCard.onlineLimit);
      setContactlessLimit(selectedCard.contactlessLimit);
      setInternationalLimit(selectedCard.internationalLimit);
    }
  }, [selectedCardId, cards]);

  // Actions
  const handleRequestDebitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setActionLoading(true);
    try {
      const newCard = await apiFetch("/cards/debit", {
        method: "POST",
        body: JSON.stringify({ accountId: debitAccountId }),
      });
      setSuccess("Debit card ordered successfully!");
      setDebitAccountId("");
      await fetchCards();
      setSelectedCardId(newCard.id);
    } catch (err: any) {
      setError(err.message || "Failed to order debit card");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyCreditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setActionLoading(true);
    try {
      const newCard = await apiFetch("/cards/credit", {
        method: "POST",
        body: JSON.stringify({
          tier: creditTier,
          requestedLimit: creditRequestedLimit ? Number(creditRequestedLimit) : undefined,
        }),
      });
      setSuccess("Credit card applied successfully! Your card is approved in INACTIVE state. Please click Activate below to start using it.");
      setCreditRequestedLimit("");
      await fetchCards();
      setSelectedCardId(newCard.id);
    } catch (err: any) {
      setError(err.message || "Failed to apply for credit card");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateCard = async (id: string) => {
    setSuccess("");
    setError("");
    setActionLoading(true);
    try {
      await apiFetch(`/cards/${id}/activate`, { method: "POST" });
      setSuccess("Card activated successfully! Welcome mock transactions seeded for evaluation.");
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to activate card");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFreeze = async (id: string, currentStatus: string) => {
    setSuccess("");
    setError("");
    const newStatus = currentStatus === "FROZEN" ? "ACTIVE" : "FROZEN";
    try {
      await apiFetch(`/cards/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      setSuccess(`Card successfully ${newStatus === "FROZEN" ? "frozen" : "unfrozen"}!`);
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to toggle card status");
    }
  };

  const handleToggleBlock = async (id: string, currentStatus: string) => {
    setSuccess("");
    setError("");
    const newStatus = currentStatus === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    try {
      await apiFetch(`/cards/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      setSuccess(`Card successfully ${newStatus === "BLOCKED" ? "blocked" : "unblocked"}!`);
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to toggle card block");
    }
  };

  const handleRequestReplacement = async (id: string) => {
    if (!confirm("Are you sure you want to request a replacement card? Your current card will be marked for replacement.")) return;
    setSuccess("");
    setError("");
    try {
      await apiFetch(`/cards/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "REPLACEMENT_REQUESTED" }),
      });
      setSuccess(`Replacement requested! Please contact branch for dispatcher details.`);
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to request replacement");
    }
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) return;
    setSuccess("");
    setError("");
    setActionLoading(true);
    try {
      await apiFetch(`/cards/${selectedCardId}/limits`, {
        method: "PUT",
        body: JSON.stringify({
          atmEnabled,
          onlineEnabled,
          contactlessEnabled,
          internationalEnabled,
          dailyLimit: Number(dailyLimit),
          atmLimit: Number(atmLimit),
          onlineLimit: Number(onlineLimit),
          contactlessLimit: Number(contactlessLimit),
          internationalLimit: Number(internationalLimit),
        }),
      });
      setSuccess("Card usage limits updated successfully!");
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to update limits");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) return;
    setSuccess("");
    setError("");
    setActionLoading(true);
    try {
      await apiFetch(`/cards/${selectedCardId}/pin`, {
        method: "POST",
        body: JSON.stringify({ pin: newPin }),
      });
      setSuccess("PIN code updated successfully!");
      setNewPin("");
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to set card PIN");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) return;
    setSuccess("");
    setError("");
    setActionLoading(true);
    try {
      await apiFetch(`/cards/${selectedCardId}/pay-bill`, {
        method: "POST",
        body: JSON.stringify({
          accountId: payBillAccountId,
          amount: Number(payBillAmount),
        }),
      });
      setSuccess(`Successfully paid credit bill of INR ${payBillAmount}! Balance updated.`);
      setPayBillAmount("");
      await fetchCards();
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to pay credit card bill");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutoPay = async (id: string, currentVal: boolean) => {
    setSuccess("");
    setError("");
    try {
      await apiFetch(`/cards/${id}/autopay`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !currentVal }),
      });
      setSuccess(`AutoPay toggled ${!currentVal ? "ON" : "OFF"}`);
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to toggle AutoPay");
    }
  };

  const handleConvertToEmi = async (transId: string) => {
    setSuccess("");
    setError("");
    const months = emiMonths[transId] || 3;
    try {
      await apiFetch(`/cards/transactions/${transId}/emi`, {
        method: "POST",
        body: JSON.stringify({ months }),
      });
      setSuccess(`Transaction successfully converted to ${months}-month EMI installment!`);
      await fetchCards();
    } catch (err: any) {
      setError(err.message || "Failed to convert transaction to EMI");
    }
  };

  const handleRedeemRewards = async (id: string) => {
    setSuccess("");
    setError("");
    try {
      const res = await apiFetch(`/cards/${id}/redeem-rewards`, { method: "POST" });
      setSuccess(`Successfully redeemed rewards points! Credit of INR ${res.cashbackCredited} made to your primary account.`);
      await fetchCards();
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to redeem rewards");
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
            <p className="truncate text-xs text-muted-foreground">Customer Hub</p>
          </div>

          <nav className="flex items-center gap-4 ml-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/accounts" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Accounts & Beneficiaries
            </Link>
            <Link href="/cards" className="text-sm font-semibold text-primary transition-colors">
              Card Management
            </Link>
          </nav>

          <ThemeToggle />
          <Button onClick={logout} variant="ghost" size="icon" className="ml-auto" aria-label="Log out">
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:py-6 animate-fade-in-up">
        
        {/* Alerts Block */}
        {success && (
          <Alert className="border-emerald-500/25 bg-emerald-500/5 text-emerald-500 shadow-sm">
            <Check className="size-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="shadow-sm">
            <AlertCircle className="size-4" />
            <AlertTitle>Operation Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Section Title */}
        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary">Cards Hub</Badge>
              <Badge variant="outline">256-bit AES Encryption</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Card Management Workspace
            </h2>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchCards} variant="outline" className="gap-1.5 text-xs">
              <RefreshCw className="size-3.5" /> Synchronize Cards
            </Button>
          </div>
        </section>

        {/* Card Deck Section */}
        {cardsLoading ? (
          <div className="text-center py-20 text-sm animate-pulse text-muted-foreground">
            Synchronizing card details with secure ledger...
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-card/40 border-dashed">
            <CreditCard className="size-16 mx-auto text-primary/30 mb-3" />
            <h3 className="text-sm font-semibold">No Cards Provisioned</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
              You do not have any debit or credit cards linked. Use the application panel below to request a card.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
            
            {/* Visual Card Stack Selector */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Active Deck</h3>
              <div className="flex flex-row overflow-x-auto gap-4 pb-2 lg:flex-col lg:overflow-visible">
                {cards.map((c) => {
                  const isSelected = c.id === selectedCardId;
                  const isCredit = c.type === "CREDIT";
                  const cardBg = isCredit 
                    ? "bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-900 text-white border-indigo-500/20" 
                    : "bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 text-white border-blue-500/20";
                  
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCardId(c.id);
                        setRevealDetails(false);
                      }}
                      className={`relative min-w-[19rem] h-[11.5rem] rounded-xl p-5 border cursor-pointer select-none transition-all shadow-lg hover:translate-y-[-2px] overflow-hidden ${cardBg} ${isSelected ? 'ring-2 ring-primary scale-[1.01]' : 'opacity-70 scale-[0.98]'}`}
                    >
                      {/* Glassmorphic sheen */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none" />
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-primary/80">{c.type} CARD</p>
                          <h4 className="font-mono text-sm tracking-wider font-semibold mt-1">
                            {revealDetails && isSelected ? c.cardNumber : c.maskedNumber}
                          </h4>
                        </div>
                        <span className="text-xs font-black italic tracking-tight opacity-90">
                          {isCredit ? "Mastercard" : "VISA"}
                        </span>
                      </div>

                      {/* Chip icon design */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="w-10 h-7 rounded bg-amber-400/80 shadow-inner relative overflow-hidden border border-amber-300">
                          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0.5 opacity-25">
                            {Array.from({ length: 9 }).map((_, i) => (
                              <div key={i} className="border-r border-b border-black" />
                            ))}
                          </div>
                        </div>
                        {isCredit && (
                          <div className="text-right">
                            <span className="text-[8px] block uppercase text-white/50 tracking-widest">Points</span>
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5 justify-end">
                              <Sparkles className="size-3" /> {c.rewardsPoints}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex justify-between items-end">
                        <div>
                          <span className="text-[7px] uppercase tracking-widest text-white/45">Card Holder</span>
                          <p className="text-xs uppercase font-medium tracking-wide truncate max-w-[12rem]">{user.fullName}</p>
                        </div>
                        <div className="flex gap-4">
                          <div>
                            <span className="text-[7px] uppercase tracking-widest text-white/45">Expires</span>
                            <p className="text-xs font-mono font-medium">{c.expiryDate}</p>
                          </div>
                          {revealDetails && isSelected && (
                            <div>
                              <span className="text-[7px] uppercase tracking-widest text-white/45">CVV</span>
                              <p className="text-xs font-mono font-medium">{c.cvv}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Badges Overlay */}
                      {c.status !== "ACTIVE" && (
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-3">
                          <Badge variant="destructive" className="uppercase font-semibold tracking-wider text-[9px] mb-2">
                            {c.status}
                          </Badge>
                          {c.status === "INACTIVE" && (
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivateCard(c.id);
                              }} 
                              size="sm" 
                              className="h-7 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Activate Card
                            </Button>
                          )}
                          {c.status === "FROZEN" && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFreeze(c.id, c.status);
                              }}
                              size="sm"
                              className="h-7 text-[10px] font-semibold bg-primary"
                            >
                              Unfreeze Card
                            </Button>
                          )}
                          {c.status === "BLOCKED" && (
                            <p className="text-[10px] text-red-400 max-w-[14rem] italic">Card is blocked. Request replacement or contact help desk.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reveal toggle button */}
              {selectedCard && selectedCard.status === "ACTIVE" && (
                <Button 
                  onClick={() => setRevealDetails(!revealDetails)}
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs gap-1.5"
                >
                  {revealDetails ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {revealDetails ? "Mask Card Details" : "Show Full Card Details"}
                </Button>
              )}
            </div>

            {/* Active Card Configuration Workspace */}
            {selectedCard ? (
              <div className="space-y-6">
                
                {/* Status Actions Header */}
                <Card className="border-border/60 bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>Card Operations</span>
                        <Badge variant="secondary" className="text-[9px] font-mono">{selectedCard.cardNumber.slice(0, 4)}...</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">Quickly freeze, block, or replace this card.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedCard.status === "ACTIVE" && (
                        <Button 
                          onClick={() => handleToggleFreeze(selectedCard.id, selectedCard.status)}
                          variant="outline" 
                          size="sm" 
                          className="text-xs text-amber-500 hover:bg-amber-500/10 border-amber-500/20"
                        >
                          <Clock className="size-3.5 mr-1" /> Freeze
                        </Button>
                      )}
                      {selectedCard.status === "ACTIVE" && (
                        <Button 
                          onClick={() => handleToggleBlock(selectedCard.id, selectedCard.status)}
                          variant="outline" 
                          size="sm" 
                          className="text-xs text-destructive hover:bg-destructive/10 border-destructive/20"
                        >
                          <Lock className="size-3.5 mr-1" /> Block
                        </Button>
                      )}
                      {selectedCard.status === "ACTIVE" && (
                        <Button 
                          onClick={() => handleRequestReplacement(selectedCard.id)}
                          variant="outline" 
                          size="sm" 
                          className="text-xs"
                        >
                          Replace
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                </Card>

                {/* Main operation grids */}
                <div className="grid gap-6 md:grid-cols-2">
                  
                  {/* Limits and Toggles Panel */}
                  <Card className="border-border/60 bg-card/65 backdrop-blur-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sliders className="size-4 text-primary" />
                        <span>Limits & Network Controls</span>
                      </CardTitle>
                      <CardDescription className="text-xs">Selectively enable networks and adjust spending caps.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSaveLimits} className="space-y-4">
                        <div className="space-y-3">
                          
                          {/* Toggle switches */}
                          <div className="flex items-center justify-between text-xs border-b pb-2">
                            <div>
                              <Label className="font-semibold block">ATM Cash Withdrawals</Label>
                              <span className="text-[10px] text-muted-foreground">Allows cash out at banking terminals</span>
                            </div>
                            <Button 
                              type="button"
                              onClick={() => setAtmEnabled(!atmEnabled)}
                              variant={atmEnabled ? "outline" : "secondary"}
                              size="sm"
                              className={`h-7 text-[10px] ${atmEnabled ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : ""}`}
                            >
                              {atmEnabled ? "ENABLED" : "DISABLED"}
                            </Button>
                          </div>

                          <div className="flex items-center justify-between text-xs border-b pb-2">
                            <div>
                              <Label className="font-semibold block">Online Transactions (E-Commerce)</Label>
                              <span className="text-[10px] text-muted-foreground">Allows internet banking shopping</span>
                            </div>
                            <Button 
                              type="button"
                              onClick={() => setOnlineEnabled(!onlineEnabled)}
                              variant={onlineEnabled ? "outline" : "secondary"}
                              size="sm"
                              className={`h-7 text-[10px] ${onlineEnabled ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : ""}`}
                            >
                              {onlineEnabled ? "ENABLED" : "DISABLED"}
                            </Button>
                          </div>

                          <div className="flex items-center justify-between text-xs border-b pb-2">
                            <div>
                              <Label className="font-semibold block">Contactless NFC Usage</Label>
                              <span className="text-[10px] text-muted-foreground">Tap and pay terminals</span>
                            </div>
                            <Button 
                              type="button"
                              onClick={() => setContactlessEnabled(!contactlessEnabled)}
                              variant={contactlessEnabled ? "outline" : "secondary"}
                              size="sm"
                              className={`h-7 text-[10px] ${contactlessEnabled ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : ""}`}
                            >
                              {contactlessEnabled ? "ENABLED" : "DISABLED"}
                            </Button>
                          </div>

                          <div className="flex items-center justify-between text-xs border-b pb-2">
                            <div>
                              <Label className="font-semibold block">International Channels</Label>
                              <span className="text-[10px] text-muted-foreground">Cross-border merchant settlements</span>
                            </div>
                            <Button 
                              type="button"
                              onClick={() => setInternationalEnabled(!internationalEnabled)}
                              variant={internationalEnabled ? "outline" : "secondary"}
                              size="sm"
                              className={`h-7 text-[10px] ${internationalEnabled ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : ""}`}
                            >
                              {internationalEnabled ? "ENABLED" : "DISABLED"}
                            </Button>
                          </div>
                        </div>

                        {/* Numeric Caps inputs */}
                        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                          <div className="space-y-1">
                            <Label htmlFor="daily-cap" className="text-[10px]">Daily Limit (INR)</Label>
                            <Input 
                              id="daily-cap"
                              type="number"
                              className="h-8 text-xs"
                              value={dailyLimit}
                              onChange={(e) => setDailyLimit(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="atm-cap" className="text-[10px]">ATM Transaction Cap</Label>
                            <Input 
                              id="atm-cap"
                              type="number"
                              className="h-8 text-xs"
                              value={atmLimit}
                              onChange={(e) => setAtmLimit(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="online-cap" className="text-[10px]">Online Cap</Label>
                            <Input 
                              id="online-cap"
                              type="number"
                              className="h-8 text-xs"
                              value={onlineLimit}
                              onChange={(e) => setOnlineLimit(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="contactless-cap" className="text-[10px]">Tap/Pay Cap</Label>
                            <Input 
                              id="contactless-cap"
                              type="number"
                              className="h-8 text-xs"
                              value={contactlessLimit}
                              onChange={(e) => setContactlessLimit(e.target.value)}
                            />
                          </div>
                        </div>

                        <Button type="submit" size="sm" className="w-full text-xs font-semibold mt-2" disabled={actionLoading || selectedCard.status !== "ACTIVE"}>
                          Apply Limit Changes
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Right: Operations controls (PIN / Credit Billing) */}
                  <div className="space-y-6">
                    
                    {/* PIN Panel */}
                    <Card className="border-border/60 bg-card/65 backdrop-blur-md">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Manage Card Security PIN</CardTitle>
                        <CardDescription className="text-xs">Update your 4-digit card checkout PIN.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleUpdatePin} className="flex gap-2 items-end">
                          <div className="space-y-1 flex-1">
                            <Label htmlFor="new-pin" className="text-[10px]">New 4-Digit PIN</Label>
                            <Input 
                              id="new-pin"
                              type="password"
                              maxLength={4}
                              placeholder="e.g. 1234"
                              value={newPin}
                              onChange={(e) => setNewPin(e.target.value)}
                              className="h-8 text-xs font-mono tracking-widest text-center"
                              required
                            />
                          </div>
                          <Button type="submit" size="sm" className="h-8 text-xs font-semibold" disabled={actionLoading || selectedCard.status !== "ACTIVE"}>
                            Update PIN
                          </Button>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Credit Card Bill payment / Autopay */}
                    {selectedCard.type === "CREDIT" && (
                      <Card className="border-border/60 bg-card/65 backdrop-blur-md">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <span>Outstanding Settlement</span>
                            <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-500 text-[10px]">
                              O/S: INR {Number(selectedCard.balance).toLocaleString()}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs">Pay statement balance from account, or configure AutoPay.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          
                          {/* AutoPay toggle */}
                          <div className="flex items-center justify-between text-xs border-b pb-2">
                            <div>
                              <Label className="font-semibold block">Statement AutoPay</Label>
                              <span className="text-[10px] text-muted-foreground">Auto-debit full outstanding monthly</span>
                            </div>
                            <Button 
                              type="button"
                              onClick={() => handleToggleAutoPay(selectedCard.id, selectedCard.autoPayEnabled)}
                              variant={selectedCard.autoPayEnabled ? "outline" : "secondary"}
                              size="sm"
                              className={`h-7 text-[10px] ${selectedCard.autoPayEnabled ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : ""}`}
                            >
                              {selectedCard.autoPayEnabled ? "ENABLED" : "DISABLED"}
                            </Button>
                          </div>

                          {/* Bill pay form */}
                          <form onSubmit={handlePayBill} className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <Label htmlFor="pay-source" className="text-[10px]">Source Banking Account</Label>
                              <Select onValueChange={setPayBillAccountId} value={payBillAccountId} required>
                                <SelectTrigger id="pay-source" className="h-8 text-xs">
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((a) => (
                                    <SelectItem key={a.id} value={a.id} className="text-xs">
                                      {a.accountNumber} ({a.type}) - Bal: INR {Number(a.balance).toLocaleString()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="pay-amount" className="text-[10px]">Amount (INR)</Label>
                              <Input 
                                id="pay-amount"
                                type="number"
                                placeholder="Amount to pay"
                                className="h-8 text-xs"
                                value={payBillAmount}
                                onChange={(e) => setPayBillAmount(e.target.value)}
                                required
                              />
                            </div>

                            <Button type="submit" size="sm" className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white" disabled={actionLoading || selectedCard.status !== "ACTIVE"}>
                              Pay Bill
                            </Button>
                          </form>

                          {/* Rewards point redemption */}
                          <div className="border-t pt-3 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-semibold text-foreground flex items-center gap-1">
                                <Sparkles className="size-3.5 text-amber-500" /> Rewards Centre
                              </p>
                              <p className="text-[10px] text-muted-foreground">Cash Value: INR {(selectedCard.rewardsPoints * 0.25).toFixed(2)}</p>
                            </div>
                            <Button
                              onClick={() => handleRedeemRewards(selectedCard.id)}
                              size="sm"
                              variant="outline"
                              className="text-[10px] h-7 border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/15 text-amber-500"
                              disabled={selectedCard.rewardsPoints <= 0 || selectedCard.status !== "ACTIVE"}
                            >
                              Redeem Cashback
                            </Button>
                          </div>

                        </CardContent>
                      </Card>
                    )}

                  </div>

                </div>

                {/* Card Transactions and EMI Converter */}
                <Card className="border-border/60 bg-card/65 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="size-5 text-primary" />
                      <span>Card Transactions & EMI Planner</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Review card transactions. Eligible purchases can be converted to low-cost EMIs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!selectedCard.transactions || selectedCard.transactions.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No recent transactions recorded on this card.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Merchant / Description</TableHead>
                              <TableHead className="text-xs">Amount</TableHead>
                              <TableHead className="text-xs">EMI Status</TableHead>
                              <TableHead className="text-xs">EMI Calculator Options</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedCard.transactions.map((t) => {
                              const amountNum = Number(t.amount);
                              const isEligible = amountNum > 1000 && !t.isEmi;
                              const monthlyEmi = isEligible 
                                ? ((amountNum * 1.145) / (emiMonths[t.id] || 3)).toFixed(2)
                                : "N/A";
                              
                              return (
                                <TableRow key={t.id}>
                                  <TableCell className="text-xs font-semibold">
                                    {t.description}
                                    <span className="block text-[9px] text-muted-foreground font-mono">{new Date(t.createdAt).toLocaleString()}</span>
                                  </TableCell>
                                  <TableCell className={`text-xs font-mono ${amountNum < 0 ? "text-emerald-500" : "text-foreground font-semibold"}`}>
                                    {amountNum < 0 ? "-" : ""} INR {Math.abs(amountNum).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    {t.isEmi ? (
                                      <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-500 text-[10px]">
                                        EMI ({t.emiMonths}M @ {t.emiInterestRate}%)
                                      </Badge>
                                    ) : amountNum < 0 ? (
                                      <Badge variant="secondary" className="text-[10px]">REPAYMENT</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px]">Standard Charge</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEligible && selectedCard.status === "ACTIVE" ? (
                                      <div className="flex items-center gap-2">
                                        <Select 
                                          onValueChange={(val) => setEmiMonths(prev => ({ ...prev, [t.id]: Number(val) }))} 
                                          value={String(emiMonths[t.id] || 3)}
                                        >
                                          <SelectTrigger className="h-7 text-[10px] w-20">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="3" className="text-xs">3 Months</SelectItem>
                                            <SelectItem value="6" className="text-xs">6 Months</SelectItem>
                                            <SelectItem value="12" className="text-xs">12 Months</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Button 
                                          onClick={() => handleConvertToEmi(t.id)}
                                          size="xs" 
                                          className="text-[10px] h-7 bg-primary text-white"
                                        >
                                          Convert (INR {monthlyEmi}/mo)
                                        </Button>
                                      </div>
                                    ) : t.isEmi ? (
                                      <span className="text-[10px] text-muted-foreground italic font-medium">Installments active</span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground italic">-</span>
                                    )}
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
            ) : null}

          </div>
        )}

        {/* Apply for Card Panel */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Apply Debit Card */}
          <Card className="border-border/60 bg-card/65 backdrop-blur-md shadow-md">
            <CardHeader>
              <CardTitle>Order Debit Card</CardTitle>
              <CardDescription>Instantly link a Visa Debit card to an active savings or current account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestDebitCard} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="debit-account" className="text-xs">Linked Banking Account</Label>
                  <Select onValueChange={setDebitAccountId} value={debitAccountId} required>
                    <SelectTrigger id="debit-account" className="text-xs">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {a.accountNumber} ({a.type}) - Bal: INR {Number(a.balance).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full text-xs font-semibold bg-primary text-white" disabled={actionLoading || accounts.length === 0}>
                  Order Debit Card
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Apply Credit Card */}
          <Card className="border-border/60 bg-card/65 backdrop-blur-md shadow-md">
            <CardHeader>
              <CardTitle>Apply for Credit Card</CardTitle>
              <CardDescription>Select card tier and specify requested credit limits.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleApplyCreditCard} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="credit-tier" className="text-xs">Select Card Tier</Label>
                    <Select onValueChange={setCreditTier} value={creditTier}>
                      <SelectTrigger id="credit-tier" className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLASSIC" className="text-xs">Classic (Limit: 50k)</SelectItem>
                        <SelectItem value="GOLD" className="text-xs">Gold (Limit: 150k)</SelectItem>
                        <SelectItem value="PLATINUM" className="text-xs">Platinum (Limit: 500k)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="credit-limit" className="text-xs">Requested Limit (INR)</Label>
                    <Input 
                      id="credit-limit"
                      type="number"
                      placeholder="e.g. 150000"
                      className="text-xs"
                      value={creditRequestedLimit}
                      onChange={(e) => setCreditRequestedLimit(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full text-xs font-semibold bg-primary text-white" disabled={actionLoading}>
                  Apply for Credit Card
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>

      </div>
    </main>
  );
}
