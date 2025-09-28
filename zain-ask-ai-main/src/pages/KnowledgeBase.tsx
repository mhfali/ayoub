import { useState, useCallback } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Trash2, Download, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  status: "processing" | "ready" | "error";
}

const KnowledgeBase = () => {
  const [files, setFiles] = useState<UploadedFile[]>([
    {
      id: "1",
      name: "Zain_Services_Guide_2024.pdf",
      size: 2048576,
      uploadDate: new Date("2024-01-15"),
      status: "ready",
    },
    {
      id: "2",
      name: "FAQ_Customer_Support.pdf",
      size: 1024768,
      uploadDate: new Date("2024-01-10"),
      status: "ready",
    },
    {
      id: "3",
      name: "Technical_Documentation.pdf",
      size: 3072896,
      uploadDate: new Date("2024-01-08"),
      status: "processing",
    },
  ]);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFiles = (fileList: FileList) => {
    const validFiles = Array.from(fileList).filter(file => 
      file.type === "application/pdf"
    );

    if (validFiles.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF files only.",
        variant: "destructive",
      });
      return;
    }

    validFiles.forEach(file => {
      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        uploadDate: new Date(),
        status: "processing",
      };

      setFiles(prev => [...prev, newFile]);

      // Simulate upload process
      setTimeout(() => {
        setFiles(prev => prev.map(f => 
          f.id === newFile.id ? { ...f, status: "ready" } : f
        ));
        toast({
          title: "File uploaded successfully",
          description: `${file.name} has been processed and added to the knowledge base.`,
        });
      }, 2000 + Math.random() * 3000);
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const deleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    toast({
      title: "File removed",
      description: "The file has been removed from the knowledge base.",
    });
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "processing":
        return <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusText = (status: UploadedFile["status"]) => {
    switch (status) {
      case "ready":
        return "Ready";
      case "processing":
        return "Processing...";
      case "error":
        return "Error";
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold gradient-hero-text">
            Knowledge Base Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage PDF files for the AI assistant's knowledge base
          </p>
        </div>

        {/* Upload Area */}
        <Card className="border-dashed border-2 border-border hover:border-primary/50 transition-colors">
          <CardContent className="pt-6">
            <div
              className={cn(
                "relative rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Upload PDF Files</h3>
                <p className="text-muted-foreground">
                  Drag and drop your PDF files here, or click to browse
                </p>
              </div>
              
              <div className="mt-6">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button className="bg-gradient-primary hover:shadow-glow transition-all duration-200">
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Files
                  </Button>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                Supports: PDF files up to 50MB each
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Files List */}
        <Card>
          <CardHeader>
            <CardTitle className="gradient-text">Uploaded Files</CardTitle>
            <CardDescription>
              {files.length} file{files.length !== 1 ? "s" : ""} in knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No files uploaded yet</p>
                <p className="text-sm">Upload your first PDF to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-gradient-surface border border-border/50 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{file.name}</h4>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{file.uploadDate.toLocaleDateString()}</span>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(file.status)}
                            <span>{getStatusText(file.status)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" disabled={file.status === "processing"}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFile(file.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default KnowledgeBase;