"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Upload, CheckCircle, FileText, Image as ImageIcon, PenTool, ShieldCheck, AlertCircle } from "lucide-react";
import { publicEnv } from "@/lib/env";

export default function KycPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [idType, setIdType] = React.useState("");
  const [idNumber, setIdNumber] = React.useState("");

  // Uploaded file keys / urls
  const [idDocKey, setIdDocKey] = React.useState("");
  const [photoKey, setPhotoKey] = React.useState("");
  const [signatureKey, setSignatureKey] = React.useState("");

  const [uploading, setUploading] = React.useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (user.status === "PENDING") {
      router.push("/");
    } else if (user.status === "APPROVED") {
      router.push("/");
    }
  }, [user, router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "ID_PROOF" | "PHOTO" | "SIGNATURE") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(prev => ({ ...prev, [type]: true }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const baseUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/kyc/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to upload file.");
      }

      const data = await res.json();
      const fileUrl = data.url || data.key;

      if (type === "ID_PROOF") setIdDocKey(fileUrl);
      if (type === "PHOTO") setPhotoKey(fileUrl);
      if (type === "SIGNATURE") setSignatureKey(fileUrl);
    } catch (err: any) {
      setUploadError(err.message || "Error uploading file.");
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!idType || !idNumber || !idDocKey || !photoKey || !signatureKey) {
      setSubmitError("Please fill out all fields and upload all required documents.");
      return;
    }

    setSubmitting(true);

    try {
      const baseUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/kyc/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idType,
          idNumber,
          idDocKey,
          photoKey,
          signatureKey,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to submit KYC.");
      }

      await refreshUser();
      router.push("/");
    } catch (err: any) {
      setSubmitError(err.message || "Error submitting KYC.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_right,oklch(0.92_0.05_184_/_0.25),transparent_32rem)] px-4 py-12 items-center justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Landmark className="size-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">KYC Verification</h1>
          <p className="text-sm text-muted-foreground">Submit your identity details to verify your banking account.</p>
        </div>

        {user.status === "REJECTED" && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>KYC Application Rejected</AlertTitle>
            <AlertDescription>
              Your previous KYC details were rejected. Please review the details below, re-upload clean documents, and submit again.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-border/60 bg-card/65 backdrop-blur-md shadow-xl">
          <CardHeader>
            <CardTitle>Identity Documentation</CardTitle>
            <CardDescription>
              We are required by financial regulations to verify your identity. Please upload clear documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" />
                <AlertTitle>Upload Error</AlertTitle>
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="size-4" />
                <AlertTitle>Submission Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Identity Document Type</Label>
                  <Select onValueChange={setIdType} value={idType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAN">PAN Card</SelectItem>
                      <SelectItem value="Aadhaar">Aadhaar Card</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                      <SelectItem value="DriverLicense">Driving License</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idNumber">Document Number</Label>
                  <Input
                    id="idNumber"
                    placeholder="Enter document/card ID number"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {/* 1. ID Doc Proof */}
                <div className="space-y-2 flex flex-col items-center border border-dashed border-border/80 rounded-xl p-4 bg-muted/10 relative hover:bg-muted/20 transition-colors">
                  <FileText className="size-8 text-primary mb-2" />
                  <span className="text-xs font-semibold text-center">ID Proof Copy</span>
                  <p className="text-[10px] text-muted-foreground text-center mb-4">PNG, JPG, or PDF</p>
                  
                  {idDocKey ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-500 font-semibold mt-auto">
                      <CheckCircle className="size-4" /> Uploaded
                    </div>
                  ) : (
                    <label className="mt-auto w-full">
                      <span className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 cursor-pointer font-medium transition-colors">
                        <Upload className="size-3.5" />
                        {uploading["ID_PROOF"] ? "Uploading..." : "Upload File"}
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "ID_PROOF")}
                        disabled={uploading["ID_PROOF"]}
                      />
                    </label>
                  )}
                </div>

                {/* 2. Photo */}
                <div className="space-y-2 flex flex-col items-center border border-dashed border-border/80 rounded-xl p-4 bg-muted/10 relative hover:bg-muted/20 transition-colors">
                  <ImageIcon className="size-8 text-primary mb-2" />
                  <span className="text-xs font-semibold text-center">Passport Photo</span>
                  <p className="text-[10px] text-muted-foreground text-center mb-4">Clear face photo (PNG, JPG)</p>
                  
                  {photoKey ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-500 font-semibold mt-auto">
                      <CheckCircle className="size-4" /> Uploaded
                    </div>
                  ) : (
                    <label className="mt-auto w-full">
                      <span className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 cursor-pointer font-medium transition-colors">
                        <Upload className="size-3.5" />
                        {uploading["PHOTO"] ? "Uploading..." : "Upload File"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "PHOTO")}
                        disabled={uploading["PHOTO"]}
                      />
                    </label>
                  )}
                </div>

                {/* 3. Signature */}
                <div className="space-y-2 flex flex-col items-center border border-dashed border-border/80 rounded-xl p-4 bg-muted/10 relative hover:bg-muted/20 transition-colors">
                  <PenTool className="size-8 text-primary mb-2" />
                  <span className="text-xs font-semibold text-center">Signature Scan</span>
                  <p className="text-[10px] text-muted-foreground text-center mb-4">Signed paper photo (PNG, JPG)</p>
                  
                  {signatureKey ? (
                    <div className="flex items-center gap-1 text-xs text-emerald-500 font-semibold mt-auto">
                      <CheckCircle className="size-4" /> Uploaded
                    </div>
                  ) : (
                    <label className="mt-auto w-full">
                      <span className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 cursor-pointer font-medium transition-colors">
                        <Upload className="size-3.5" />
                        {uploading["SIGNATURE"] ? "Uploading..." : "Upload File"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "SIGNATURE")}
                        disabled={uploading["SIGNATURE"]}
                      />
                    </label>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary font-medium shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all mt-4"
                disabled={submitting || !idType || !idNumber || !idDocKey || !photoKey || !signatureKey}
              >
                {submitting ? "Submitting KYC..." : "Submit KYC Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
