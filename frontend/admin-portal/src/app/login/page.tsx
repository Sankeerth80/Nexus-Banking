"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Landmark, Lock, Mail, ShieldAlert, Fingerprint } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { getErrorMessage } from "@/lib/errors";

export default function AdminLoginPage() {
  const { login, verify2fa, verifyOtp, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const [step, setStep] = React.useState<"credentials" | "2fa" | "otp">(
    "credentials",
  );
  const [pendingUserId, setPendingUserId] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.step === "2fa") {
        setPendingUserId(res.userId || "");
        setStep("2fa");
      } else if (res.step === "otp") {
        setPendingUserId(res.userId || "");
        setStep("otp");
      } else if (res.step === "complete") {
        router.push("/");
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Invalid employee credentials."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (step === "2fa") {
        await verify2fa(pendingUserId, code);
      } else {
        await verifyOtp(pendingUserId, code);
      }
      router.push("/");
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Invalid verification code."));
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill demo accounts for developers
  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(publicEnv.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Landmark className="size-6 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Nexus Banking</h1>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider text-primary/80">
            Employee Operations Console
          </p>
        </div>

        <Card className="border-border/60 bg-card/65 backdrop-blur-md shadow-xl">
          <CardHeader>
            <CardTitle>
              {step === "credentials" && "Employee Sign In"}
              {step === "2fa" && "Two-Factor Auth"}
              {step === "otp" && "Email Verification Code"}
            </CardTitle>
            <CardDescription>
              {step === "credentials" &&
                "Enter your email and credentials to manage the workspace."}
              {step === "2fa" &&
                "Open your authenticator app and enter the code."}
              {step === "otp" &&
                `We've sent a 6-digit OTP to your registered email.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <ShieldAlert className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === "credentials" ? (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="employee@nexus.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary font-medium shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all"
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Sign In to Console"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerificationSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <div className="relative">
                    <Fingerprint className="absolute left-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      id="code"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="pl-9 text-center font-mono text-lg tracking-widest"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary font-medium"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setStep("credentials")}
                >
                  Back to Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {step === "credentials" && (
          <Card className="border-border/40 bg-muted/20 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase mb-3">
              Quick Sandbox Login
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDemoAccount("ceo@gmail.com")}
                className="justify-start text-left font-mono"
              >
                ceo@gmail.com (CEO)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDemoAccount("kyc@gmail.com")}
                className="justify-start text-left font-mono"
              >
                kyc@gmail.com (KYC)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDemoAccount("compliance@gmail.com")}
                className="justify-start text-left font-mono"
              >
                compliance@gmail.com (CMP)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDemoAccount("risk@gmail.com")}
                className="justify-start text-left font-mono"
              >
                risk@gmail.com (Risk)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDemoAccount("manager@gmail.com")}
                className="justify-start text-left font-mono"
              >
                manager@gmail.com (Mgr)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDemoAccount("admin@gmail.com")}
                className="justify-start text-left font-mono"
              >
                admin@gmail.com (Admin)
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
