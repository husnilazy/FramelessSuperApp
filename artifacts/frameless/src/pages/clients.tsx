import { useState } from "react";
import { useListClients, useCreateClient, useDeleteClient, type CreateClientBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, UsersRound, Mail, Phone, Building2, Search, Trash2 } from "lucide-react";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useListClients({ search: search || undefined });

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        setOpen(false);
        toast({ title: "Client added" });
      },
    },
  });

  const deleteMutation = useDeleteClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        toast({ title: "Client removed" });
      },
    },
  });

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-white">Clients</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Client Database</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading tracking-wider text-2xl">New Client</DialogTitle>
            </DialogHeader>
            <NewClientForm
              onSubmit={(data) => createMutation.mutate({ data })}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {clients?.map((client) => (
              <Card key={client.id} className="glass-panel border-white/5 group hover:border-primary/20 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-primary font-heading text-xl">{client.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">{client.name}</h3>
                        {client.company && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground truncate">{client.company}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 mt-3">
                          {client.email && (
                            <a href={`mailto:${client.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <Mail className="w-3 h-3" />
                              {client.email}
                            </a>
                          )}
                          {client.phone && (
                            <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <Phone className="w-3 h-3" />
                              {client.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => deleteMutation.mutate({ id: client.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {clients?.length === 0 && (
              <div className="col-span-2 glass-panel rounded-xl p-12 text-center">
                <UsersRound className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm uppercase tracking-wider">No clients found</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NewClientForm({ onSubmit, isPending }: { onSubmit: (data: CreateClientBody) => void; isPending: boolean }) {
  const [form, setForm] = useState<CreateClientBody>({ name: "", email: "", phone: "", company: "", address: "" });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Name *</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="Client name" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Company</label>
        <Input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })}
          className="bg-white/5 border-white/10 text-white" placeholder="PT ..." />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
        <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="bg-white/5 border-white/10 text-white" placeholder="email@domain.com" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Phone</label>
        <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="bg-white/5 border-white/10 text-white" placeholder="+62..." />
      </div>
      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
        {isPending ? "Adding..." : "Add Client"}
      </Button>
    </form>
  );
}
