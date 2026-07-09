import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { CheckCircle, MessageSquare, Eye, Inbox, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Submission {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: "concept" | "script" | "shotlist" | "screenplay";
  crewMemberName: string;
  crewMemberEmail: string;
  submittedAt: string;
  status: "pending" | "approved" | "revision_requested";
  adminNotes?: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20",
  approved: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
  revision_requested: "bg-orange-500/15 text-orange-300 border border-orange-500/20",
};

const DOC_TYPE_ICON: Record<string, string> = {
  concept: "💡",
  screenplay: "📖",
  script: "📝",
  shotlist: "🎬",
};

export function FilmmakingSubmissionsAdmin() {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "revision_requested">(
    "pending"
  );
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(
    null
  );
  const [revisionNotes, setRevisionNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const [requestingRevision, setRequestingRevision] = useState(false);

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
      toast({ variant: "destructive", title: "Gagal memuat daftar submission" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submissionId: string) => {
    setApproving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/filmmaking-submissions/${submissionId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to approve");

      setSubmissions(
        submissions.map((s) =>
          s.id === submissionId ? { ...s, status: "approved" } : s
        )
      );
      setSelectedSubmission(null);
      toast({ title: "Submission disetujui ✅" });
    } catch (err) {
      console.error("Failed to approve submission:", err);
      toast({ variant: "destructive", title: "Gagal menyetujui submission" });
    } finally {
      setApproving(false);
    }
  };

  const handleRequestRevision = async (submissionId: string) => {
    setRequestingRevision(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/filmmaking-submissions/${submissionId}/request-revision`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adminNotes: revisionNotes }),
      });
      if (!res.ok) throw new Error("Failed to request revision");

      setSubmissions(
        submissions.map((s) =>
          s.id === submissionId
            ? { ...s, status: "revision_requested", adminNotes: revisionNotes }
            : s
        )
      );
      setRevisionNotes("");
      setSelectedSubmission(null);
      toast({ title: "Revisi diminta ke crew" });
    } catch (err) {
      console.error("Failed to request revision:", err);
      toast({ variant: "destructive", title: "Gagal meminta revisi" });
    } finally {
      setRequestingRevision(false);
    }
  };

  const getStatusBadge = (status: string) => (
    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
      {status.replace("_", " ")}
    </span>
  );

  return (
    <div className="flex flex-col gap-4 p-6 bg-zinc-950 text-zinc-100 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Filmmaking Submissions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Review dokumen produksi yang dikirim crew untuk approval.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 pb-3">
        {(["all", "pending", "approved", "revision_requested"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap ${
                filter === status
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading submissions...
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-zinc-400">No submissions found</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-2xl overflow-x-auto bg-zinc-900/40">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-900/80 hover:bg-zinc-900/80 border-zinc-800">
                <TableHead className="w-8 text-zinc-500"></TableHead>
                <TableHead className="w-40 text-zinc-400">Document</TableHead>
                <TableHead className="w-32 text-zinc-400">Type</TableHead>
                <TableHead className="w-32 text-zinc-400">Crew Member</TableHead>
                <TableHead className="w-32 text-zinc-400">Submitted</TableHead>
                <TableHead className="w-24 text-zinc-400">Status</TableHead>
                <TableHead className="w-32 text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-zinc-800/40 border-zinc-800">
                  <TableCell className="text-lg">
                    {DOC_TYPE_ICON[sub.documentType] || "📄"}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-200">
                    {sub.documentTitle}
                  </TableCell>
                  <TableCell className="capitalize text-sm text-zinc-400">
                    {sub.documentType}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium text-zinc-200">{sub.crewMemberName}</p>
                      <p className="text-zinc-500 text-xs">{sub.crewMemberEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedSubmission(sub)}
                          className="gap-1 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700 text-zinc-100">
                        <DialogHeader>
                          <DialogTitle className="text-zinc-100">{sub.documentTitle}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4 max-h-96 overflow-auto">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-zinc-500">Submitted by</p>
                              <p className="font-medium text-zinc-200">{sub.crewMemberName}</p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Date</p>
                              <p className="font-medium text-zinc-200">
                                {new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Type</p>
                              <p className="font-medium text-zinc-200 capitalize">
                                {sub.documentType}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Status</p>
                              <p className="font-medium text-zinc-200">{getStatusBadge(sub.status)}</p>
                            </div>
                          </div>

                          {sub.adminNotes && (
                            <div className="border-t border-zinc-800 pt-4">
                              <p className="text-sm text-zinc-500 mb-2">
                                Admin Notes
                              </p>
                              <p className="text-sm bg-zinc-800 text-zinc-200 p-3 rounded-xl">
                                {sub.adminNotes}
                              </p>
                            </div>
                          )}

                          {sub.status === "pending" && (
                            <div className="border-t border-zinc-800 pt-4 space-y-3">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                                    <CheckCircle className="w-4 h-4" />
                                    Approve
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                                  <DialogHeader>
                                    <DialogTitle className="text-zinc-100">Approve Submission?</DialogTitle>
                                  </DialogHeader>
                                  <p className="text-sm text-zinc-400">
                                    Are you sure you want to approve this submission?
                                  </p>
                                  <div className="flex gap-2 justify-end pt-4">
                                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Cancel</Button>
                                    <Button
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                                      onClick={() => handleApprove(sub.id)}
                                      disabled={approving}
                                    >
                                      {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                                      Approve
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full gap-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    Request Revision
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
                                  <DialogHeader>
                                    <DialogTitle className="text-zinc-100">Request Revision</DialogTitle>
                                  </DialogHeader>
                                  <Textarea
                                    placeholder="Add notes for the crew member..."
                                    value={revisionNotes}
                                    onChange={(e) =>
                                      setRevisionNotes(e.target.value)
                                    }
                                    className="min-h-24 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                                  />
                                  <div className="flex gap-2 justify-end pt-4">
                                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Cancel</Button>
                                    <Button
                                      className="bg-orange-600 hover:bg-orange-500 text-white gap-2"
                                      onClick={() => handleRequestRevision(sub.id)}
                                      disabled={requestingRevision}
                                    >
                                      {requestingRevision && <Loader2 className="w-4 h-4 animate-spin" />}
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