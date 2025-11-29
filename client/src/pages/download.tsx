import { useState, useEffect } from "react";
import { useParams, Link, useSearch } from "wouter";
import { Download, Lock, ArrowLeft, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface FileInfo {
  id: string;
  originalName: string;
  size: number;
  category: string;
  isLocked: boolean;
  sizeFormatted?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DownloadPage() {
  const params = useParams();
  const searchString = useSearch();
  const fileId = params.id;
  
  const [file, setFile] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (searchString.includes('error=invalid')) {
      setPinError("Incorrect PIN. Please try again.");
    }
  }, [searchString]);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const response = await fetch(`/api/files/${fileId}`);
        if (response.ok) {
          const data = await response.json();
          setFile(data);
          
          if (!data.isLocked) {
            window.location.href = `/api/download/${fileId}`;
          }
        } else {
          setError("File not found");
        }
      } catch {
        setError("Failed to load file information");
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchFile();
    }
  }, [fileId]);

  const handleDownload = async (pinValue: string = pin) => {
    if (!file || pinValue.length !== 4) return;
    
    setDownloading(true);
    setPinError("");
    
    try {
      const response = await fetch(`/api/files/${file.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue })
      });
      
      const data = await response.json();
      
      if (data.valid) {
        window.location.href = `/api/download/${file.id}?pin=${pinValue}`;
      } else {
        setPinError("Incorrect PIN. Please try again.");
        setPin("");
      }
    } catch {
      setPinError("Error verifying PIN. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4">
        <Card className="max-w-md w-full bg-slate-800/90 border-slate-700">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-white mb-2">File Not Found</h2>
            <p className="text-slate-400 mb-6">{error || "The file you're looking for doesn't exist or has been removed."}</p>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4">
      <Card className="max-w-md w-full bg-slate-800/90 border-slate-700">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-1">Locked File</h2>
            <p className="text-slate-400 text-sm">This file is protected with a PIN</p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-10 h-10 text-slate-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-white font-medium truncate" data-testid="text-filename">
                  {file.originalName}
                </p>
                <p className="text-slate-400 text-sm">
                  {file.sizeFormatted || formatFileSize(file.size)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Enter 4-digit PIN to download</label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(value);
                  setPinError("");
                  if (value.length === 4) {
                    handleDownload(value);
                  }
                }}
                placeholder="Enter PIN"
                className="w-full text-center text-2xl tracking-[0.3em] bg-slate-700 border-slate-600 font-mono"
                maxLength={4}
                autoFocus
                data-testid="input-pin"
              />
            </div>

            {pinError && (
              <p className="text-red-400 text-sm text-center">{pinError}</p>
            )}

            <Button
              onClick={() => handleDownload()}
              disabled={pin.length !== 4 || downloading}
              className="w-full bg-[#de5c5c] hover:bg-[#c94a4a] text-white"
              data-testid="button-download"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? "Verifying..." : "Download"}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
