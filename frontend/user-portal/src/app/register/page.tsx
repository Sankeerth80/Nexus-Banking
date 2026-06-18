"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Landmark, Check, X, ShieldCheck, Mail, Phone, User, Lock } from "lucide-react";
import { publicEnv } from "@/lib/env";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  // Password criteria states
  const meetsLength = password.length >= 8;
  const meetsUpper = /[A-Z]/.test(password);
  const meetsLower = /[a-z]/.test(password);
  const meetsNumber = /[0-9]/.test(password);
  const meetsSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = meetsLength && meetsUpper && meetsLower && meetsNumber && meetsSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("Please satisfy all password criteria.");
      return;
    }

    setLoading(true);

    try {
      const baseUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Registration failed.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 4000);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordRequirement = (label: string, met: boolean) => (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="size-3.5 text-emerald-500 font-bold" />
      ) : (
        <X className="size-3.5 text-muted-foreground/60" />
      )}
      <span className={met ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)] px-4">
        <Card className="w-full max-w-md border-border/60 bg-card/65 backdrop-blur-md shadow-2xl text-center p-8 space-y-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-md shadow-emerald-500/10">
            <ShieldCheck className="size-8 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Registration Successful!</h2>
            <p className="text-sm text-muted-foreground">
              Your customer profile has been created. A verification code has been sent to your email address: <strong className="text-foreground">{email}</strong>.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Redirecting you to the login screen to verify your email and sign in...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.05_184_/_0.35),transparent_32rem)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Landmark className="size-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Nexus Banking</h1>
          <p className="text-sm text-muted-foreground">Open a Sim-Only Net Banking Profile</p>
        </div>

        <Card className="border-border/60 bg-card/65 backdrop-blur-md shadow-xl">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Get started in minutes with our digitized banking platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <X className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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

                <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1.5 mt-2">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Password Requirements:</span>
                  {renderPasswordRequirement("Minimum 8 characters", meetsLength)}
                  {renderPasswordRequirement("At least one uppercase letter", meetsUpper)}
                  {renderPasswordRequirement("At least one lowercase letter", meetsLower)}
                  {renderPasswordRequirement("At least one number", meetsNumber)}
                  {renderPasswordRequirement("At least one special character", meetsSpecial)}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary font-medium mt-4 shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all"
                disabled={loading}
              >
                {loading ? "Registering..." : "Create Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
