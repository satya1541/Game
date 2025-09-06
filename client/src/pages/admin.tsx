import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, Download, Upload, Users, FileText, TrendingUp, Calendar, Database, Cloud, Globe, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/header";

export default function Admin() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch general stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats", refreshKey],
    staleTime: 30000,
  });

  // Fetch detailed admin stats (we'll need to create this endpoint)
  const { data: adminStats, isLoading: adminLoading } = useQuery({
    queryKey: ["/api/admin/stats", refreshKey],
    staleTime: 30000,
  });

  // Fetch all files with download stats
  const { data: allFiles, isLoading: filesLoading } = useQuery({
    queryKey: ["/api/admin/files", refreshKey],
    staleTime: 30000,
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (statsLoading || adminLoading || filesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading admin dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Admin Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-destructive to-destructive/70 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-gaming font-bold bg-gradient-to-r from-destructive to-orange-500 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">System overview and detailed analytics</p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <TrendingUp className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        <div className="space-y-6">
          {/* Main Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalFiles || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Storage used: {stats?.totalStorage || "0 B"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
                <Download className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalDownloads || 0}</div>
                <p className="text-xs text-muted-foreground">
                  All time downloads
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Registered users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">S3 Storage</CardTitle>
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">Optimized</div>
                <p className="text-xs text-muted-foreground">
                  {adminStats?.overview?.s3StorageInfo?.provider || 'AWS S3'} • {adminStats?.overview?.s3StorageInfo?.region || 'ap-south-2'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* S3 Storage Optimizations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span>S3 Storage Optimizations</span>
              </CardTitle>
              <CardDescription>Current AWS S3 performance features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {adminStats?.overview?.s3StorageInfo?.optimizations?.map((optimization: string, index: number) => (
                  <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">{optimization}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Files by Category</CardTitle>
              <CardDescription>Distribution of uploaded files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(adminStats?.overview?.categoryStats || stats?.categoryStats) && Object.entries(adminStats?.overview?.categoryStats || stats.categoryStats).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <span className="font-medium capitalize">{category}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Most Downloaded Files */}
          <Card>
            <CardHeader>
              <CardTitle>Most Downloaded Files</CardTitle>
              <CardDescription>Files ranked by download count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allFiles?.files?.slice(0, 10).map((file: any, index: number) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{file.originalName}</p>
                        <p className="text-sm text-muted-foreground">
                          {file.category} • {file.sizeFormatted}
                        </p>
                        {file.s3Url && (
                          <p className="text-xs text-cyan-500 font-mono">
                            <Globe className="w-3 h-3 inline mr-1" />
                            S3 Direct Access
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{file.downloadCount} downloads</p>
                      <p className="text-sm text-muted-foreground">
                        Uploaded {file.uploadedAtFormatted}
                      </p>
                      {(file.adminViewUrl || file.s3Url) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1"
                          onClick={() => window.open(file.adminViewUrl || file.s3Url, '_blank')}
                        >
                          <Cloud className="w-3 h-3 mr-1" />
                          View S3
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Downloads */}
          {adminStats?.recentDownloads && adminStats.recentDownloads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Download className="w-5 h-5 text-green-500" />
                  <span>Recent Downloads</span>
                </CardTitle>
                <CardDescription>Latest file download activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adminStats.recentDownloads.slice(0, 10).map((download: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Download className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="font-medium">{download.fileName}</p>
                          <p className="text-sm text-muted-foreground">
                            {download.category} • {download.fileSize}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{download.downloadTime}</p>
                        <p className="text-xs text-muted-foreground">
                          IP: {download.ipAddress}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload History */}
          <Card>
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>All file uploads with S3 storage information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {allFiles?.files?.map((file: any) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Upload className="w-4 h-4 text-accent" />
                      <div>
                        <p className="font-medium">{file.originalName}</p>
                        <p className="text-sm text-muted-foreground">
                          {file.category} • {file.sizeFormatted}
                        </p>
                        {file.s3Url && (
                          <p className="text-xs text-cyan-500 font-mono truncate max-w-[300px]">
                            <Cloud className="w-3 h-3 inline mr-1" />
                            S3: {file.s3Key || 'Direct access enabled'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-sm font-medium">{file.uploadedAtFormatted}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.downloadCount} downloads
                      </p>
                      {(file.adminViewUrl || file.s3Url) && (
                        <div className="mt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(file.adminViewUrl || file.s3Url, '_blank')}
                          >
                            <Globe className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}