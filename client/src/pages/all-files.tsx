import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Download, Search, ArrowLeft, Copy, Check, ExternalLink, Lock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FileRecord {
  id: string;
  originalName: string;
  size: number;
  category: string;
  uploadedAt: string;
  downloads: number;
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

const getCategoryDisplayName = (category: string): string => {
  const names: Record<string, string> = {
    'scripts': 'Script',
    'configs': 'Config',
    'softwares': 'Software',
    'archives': 'Archive',
    'apks': 'APK',
    'images': 'Image',
    'videos': 'Video',
    'emulators': 'Emulator',
    'regs': 'Registry'
  };
  return names[category] || category;
};

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'scripts': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'configs': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'softwares': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'archives': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'apks': 'bg-green-500/20 text-green-300 border-green-500/30',
    'images': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'videos': 'bg-red-500/20 text-red-300 border-red-500/30',
    'emulators': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'regs': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  };
  return colors[category] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
};

const PAGE_NAME = '/404';
const VERIFIED_KEY = `h4vx_page_404_verified`;

export default function AllFiles() {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [requiresPin, setRequiresPin] = useState<boolean | null>(null);
  
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<FileRecord | null>(null);
  const [downloadPin, setDownloadPin] = useState("");
  const [downloadPinError, setDownloadPinError] = useState("");

  const { data, isLoading } = useQuery<{ files: FileRecord[] }>({
    queryKey: ["/api/files", isVerified ? pin : null],
    enabled: isVerified,
    queryFn: async () => {
      // Send PIN with request for backend verification
      const response = await fetch("/api/files", {
        headers: {
          'X-Page-Pin': pin,
          'X-Page-Name': PAGE_NAME
        }
      });
      if (!response.ok) throw new Error("Failed to fetch files");
      return response.json();
    }
  });

  // Check if PIN is required on mount
  useEffect(() => {
    const checkPin = async () => {
      try {
        const response = await fetch(`/api/page-settings/has-pin?pageName=${PAGE_NAME}`);
        const result = await response.json();
        setRequiresPin(result.hasPin);
        
        // Check if already verified in localStorage
        if (!result.hasPin) {
          setIsVerified(true);
        } else {
          const verified = localStorage.getItem(VERIFIED_KEY);
          if (verified === 'true') {
            setIsVerified(true);
          }
        }
      } catch (error) {
        console.error('Failed to check PIN requirement', error);
        setRequiresPin(false);
        setIsVerified(true);
      }
    };
    
    checkPin();
  }, []);

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinLoading(true);
    setPinError("");
    
    try {
      const response = await fetch('/api/page-settings/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageName: PAGE_NAME, pin })
      });
      
      const result = await response.json();
      
      if (result.valid) {
        localStorage.setItem(VERIFIED_KEY, 'true');
        setIsVerified(true);
      } else {
        setPinError("Incorrect PIN. Please try again.");
        setPin("");
      }
    } catch (error) {
      setPinError("Failed to verify PIN. Please try again.");
    } finally {
      setPinLoading(false);
    }
  };

  // Auto-submit when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4 && !pinLoading) {
      handleVerifyPin();
    }
  }, [pin, pinLoading]);

  if (requiresPin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (requiresPin && !isVerified) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Lock className="w-12 h-12 mx-auto mb-4 text-[#de5c5c]" />
              <h1 className="text-2xl font-gaming font-bold text-[#de5c5c] mb-2">ACCESS RESTRICTED</h1>
              <p className="text-slate-600 dark:text-slate-300">This page is protected with a PIN</p>
            </div>
            
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.slice(0, 4))}
                  maxLength={4}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-page-pin"
                />
              </div>
              
              {pinError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-md text-red-300 text-sm">
                  {pinError}
                </div>
              )}
              
              <Button
                type="submit"
                disabled={pin.length !== 4 || pinLoading}
                className="w-full bg-[#de5c5c] hover:bg-[#c94a4a]"
                data-testid="button-verify-pin"
              >
                {pinLoading ? "Verifying..." : "Unlock"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const files = data?.files || [];
  
  const filteredFiles = files.filter(file => 
    file.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDownloadLink = (fileId: string) => {
    return `${window.location.origin}/api/download/${fileId}`;
  };

  const copyToClipboard = async (fileId: string) => {
    const link = getDownloadLink(fileId);
    await navigator.clipboard.writeText(link);
    setCopiedId(fileId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadClick = (file: FileRecord, e: React.MouseEvent) => {
    if (file.isLocked) {
      e.preventDefault();
      setDownloadingFile(file);
      setDownloadPin("");
      setDownloadPinError("");
      setDownloadDialogOpen(true);
    }
  };

  const handleLockedDownload = async () => {
    if (!downloadingFile || downloadPin.length !== 4) return;
    
    try {
      const response = await fetch(`/api/files/${downloadingFile.id}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: downloadPin })
      });
      
      const data = await response.json();
      
      if (data.valid) {
        const downloadUrl = `${window.location.origin}/api/download/${downloadingFile.id}?pin=${downloadPin}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloadDialogOpen(false);
        setDownloadingFile(null);
        setDownloadPin("");
      } else {
        setDownloadPinError("Incorrect PIN. Please try again.");
        setDownloadPin("");
      }
    } catch {
      setDownloadPinError("Error verifying PIN. Please try again.");
      setDownloadPin("");
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 gap-2" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
          
          <h1 className="text-4xl md:text-5xl font-gaming font-bold text-[#de5c5c] mb-2">
            ALL FILES
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            Direct download links for all uploaded files
          </p>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
              data-testid="input-search-files"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="py-20 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 dark:text-slate-300 text-lg">
                {searchQuery ? "No files match your search" : "No files uploaded yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''} found
            </div>
            
            {filteredFiles.map((file) => (
              <Card 
                key={file.id} 
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover-elevate"
                data-testid={`card-file-${file.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-slate-900 dark:text-white truncate" data-testid={`text-filename-${file.id}`}>
                          {file.originalName}
                        </h3>
                        {file.isLocked && (
                          <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getCategoryColor(file.category)}`}
                        >
                          {getCategoryDisplayName(file.category)}
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {file.sizeFormatted || formatFileSize(file.size)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {file.downloads} downloads
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="hidden md:block">
                        <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300 max-w-[300px] truncate block">
                          {getDownloadLink(file.id)}
                        </code>
                      </div>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(file.id)}
                        title="Copy download link"
                        data-testid={`button-copy-${file.id}`}
                      >
                        {copiedId === file.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <a 
                        href={getDownloadLink(file.id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        data-testid={`link-download-${file.id}`}
                        onClick={(e) => handleDownloadClick(file, e)}
                      >
                        <Button size="icon" variant="ghost" title="Open in new tab">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                      
                      <a 
                        href={getDownloadLink(file.id)} 
                        download
                        data-testid={`button-download-${file.id}`}
                        onClick={(e) => handleDownloadClick(file, e)}
                      >
                        <Button size="sm" className="gap-2 bg-[#de5c5c] hover:bg-[#c94a4a] text-white">
                          <Download className="w-4 h-4" />
                          {file.isLocked ? "Unlock & Download" : "Download"}
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900/95 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-amber-500" />
              Locked File
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter the 4-digit PIN to download{" "}
              <span className="font-medium text-white">
                {downloadingFile?.originalName}
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            <Input
              type="password"
              value={downloadPin}
              onChange={async (e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setDownloadPin(value);
                setDownloadPinError("");
                if (value.length === 4 && downloadingFile) {
                  try {
                    const response = await fetch(`/api/files/${downloadingFile.id}/verify-pin`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pin: value })
                    });
                    
                    const data = await response.json();
                    
                    if (data.valid) {
                      const downloadUrl = `${window.location.origin}/api/download/${downloadingFile.id}?pin=${value}`;
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = '';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      setDownloadDialogOpen(false);
                      setDownloadingFile(null);
                      setDownloadPin("");
                    } else {
                      setDownloadPinError("Incorrect PIN. Please try again.");
                      setDownloadPin("");
                    }
                  } catch {
                    setDownloadPinError("Error verifying PIN. Please try again.");
                    setDownloadPin("");
                  }
                }
              }}
              placeholder="Enter 4-digit PIN"
              className="w-full text-center text-2xl tracking-[0.3em] bg-slate-800 border-slate-600 font-mono"
              maxLength={4}
              autoFocus
              data-testid="input-download-pin"
            />
            
            {downloadPinError && (
              <p className="text-red-400 text-sm">{downloadPinError}</p>
            )}
            
            <Button
              onClick={handleLockedDownload}
              disabled={downloadPin.length !== 4}
              className="w-full bg-[#de5c5c] hover:bg-[#c94a4a] text-white"
              data-testid="button-confirm-download"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
