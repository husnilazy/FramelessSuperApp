import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, X, MessageSquare, Eye } from "lucide-react";

interface Submission {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: "concept" | "script" | "shotlist";
  crewMemberName: string;
  crewMemberEmail: string;
  submittedAt: string;
  status: "pending" | "approved" | "revision_requested";
  adminNotes?: string;
}

export function FilmmakingSubmissionsAdmin() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "revision_requested">(
    "pending"
  );
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(
    null
  );
  const [revisionNotes, setRevisionNotes] = useState("");

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = filter !== "all" ? `?status=${filter}` : "";
      const response = await fetch(`/api/filmmaking-submissions${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch submissions");
      const data = await response.json();
      setSubmissions(data);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submissionId: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/filmmaking-submissions/${submissionId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      setSubmissions(
        submissions.map((s) =>
          s.id === submissionId ? { ...s, status: "approved" } : s
        )
      );
      setSelectedSubmission(null);
    } catch (err) {
      console.error("Failed to approve submission:", err);
    }
  };

  const handleRequestRevision = async (submissionId: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/filmmaking-submissions/${submissionId}/request-revision`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adminNotes: revisionNotes }),
      });

      setSubmissions(
        submissions.map((s) =>
          s.id === submissionId
            ? { ...s, status: "revision_requested", adminNotes: revisionNotes }
            : s
        )
      );
      setRevisionNotes("");
      setSelectedSubmission(null);
    } catch (err) {
      console.error("Failed to request revision:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      revision_requested: "bg-orange-100 text-orange-800",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
          colors[status as keyof typeof colors] || colors.pending
        }`}
      >
        {status.replace("_", " ")}
      </span>
    );
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case "concept":
        return "💡";
      case "script":
        return "📝";
      case "shotlist":
        return "🎬";
      default:
        return "📄";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Filmmaking Submissions</h1>
      </div>

      <div className="flex gap-2">
        {(["all", "pending", "approved", "revision_requested"] as const).map(
          (status) => (
            <Button
              key={status}
              variant={filter === status ? "default" : "outline"}
              onClick={() => setFilter(status)}
              className="capitalize"
            >
              {status.replace("_", " ")}
            </Button>
          )
        )}
      </div>

      {loading ? (
        <div className="p-4">Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No submissions found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-40">Document</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-32">Crew Member</TableHead>
                <TableHead className="w-32">Submitted</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-gray-50">
                  <TableCell className="text-lg">
                    {getDocTypeIcon(sub.documentType)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {sub.documentTitle}
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {sub.documentType}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{sub.crewMemberName}</p>
                      <p className="text-gray-500 text-xs">{sub.crewMemberEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(sub.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedSubmission(sub)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{sub.documentTitle}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4 max-h-96 overflow-auto">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Submitted by</p>
                              <p className="font-medium">{sub.crewMemberName}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Date</p>
                              <p className="font-medium">
                                {new Date(sub.submittedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Type</p>
                              <p className="font-medium capitalize">
                                {sub.documentType}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Status</p>
                              <p className="font-medium">{sub.status}</p>
                            </div>
                          </div>

                          {sub.adminNotes && (
                            <div className="border-t pt-4">
                              <p className="text-sm text-gray-600 mb-2">
                                Admin Notes
                              </p>
                              <p className="text-sm bg-gray-50 p-3 rounded">
                                {sub.adminNotes}
                              </p>
                            </div>
                          )}

                          {sub.status === "pending" && (
                            <div className="border-t pt-4 space-y-3">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                                    <CheckCircle className="w-4 h-4" />
                                    Approve
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Approve Submission?</DialogTitle>
                                  </DialogHeader>
                                  <p className="text-sm text-gray-600">
                                    Are you sure you want to approve this submission?
                                  </p>
                                  <div className="flex gap-2 justify-end pt-4">
                                    <Button variant="outline">Cancel</Button>
                                    <Button
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => handleApprove(sub.id)}
                                    >
                                      Approve
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    Request Revision
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Request Revision</DialogTitle>
                                  </DialogHeader>
                                  <Textarea
                                    placeholder="Add notes for the crew member..."
                                    value={revisionNotes}
                                    onChange={(e) =>
                                      setRevisionNotes(e.target.value)
                                    }
                                    className="min-h-24"
                                  />
                                  <div className="flex gap-2 justify-end pt-4">
                                    <Button variant="outline">Cancel</Button>
                                    <Button
                                      className="bg-orange-600 hover:bg-orange-700"
                                      onClick={() =>
                                        handleRequestRevision(sub.id)
                                      }
                                    >
                                      Request Revision
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default FilmmakingSubmissionsAdmin;
