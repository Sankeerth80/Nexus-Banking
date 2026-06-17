"use client";

import * as React from "react";
import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const demoAdminEmail = "admin@gmail.com";
const demoAdminPassword = "Admin@1234";

export function AdminLoginGate({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = React.useState(demoAdminEmail);
  const [password, setPassword] = React.useState("");
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailMatches = email.trim().toLowerCase() === demoAdminEmail;
    const passwordMatches = password === demoAdminPassword;

    if (!emailMatches || !passwordMatches) {
      setError("The email or password is incorrect.");
      return;
    }

    setError("");
    setPassword("");
    setIsAuthenticated(true);
  };

  if (isAuthenticated) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">Signed in as {demoAdminEmail}</p>
              <p className="text-xs text-muted-foreground">Master admin session</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAuthenticated(false)}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="grid min-h-[28rem] place-items-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" aria-hidden />
          </div>
          <CardTitle>Master admin sign in</CardTitle>
          <CardDescription>Restricted operations console</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Sign in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full">
              <ShieldCheck />
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
