import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        toast({ title: "Access Granted", description: "Welcome to Frameless Control." });
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({ 
          variant: "destructive",
          title: "Access Denied", 
          description: error.message || "Invalid credentials" 
        });
      }
    }
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex items-center justify-center relative overflow-hidden">
      {/* Dramatic cinematic background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10 p-8"
      >
        <div className="mb-10 text-center space-y-2">
          <h1 className="text-5xl font-heading tracking-widest text-white">FRAMELESS™</h1>
          <p className="text-muted-foreground tracking-widest text-sm uppercase font-semibold">Operational Control</p>
        </div>

        <div className="glass-panel rounded-xl p-8 border-t border-primary/20">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Operator ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="admin@frameless.com" 
                        {...field} 
                        className="bg-black/50 border-white/10 focus:border-primary/50 text-white h-12"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Clearance Code</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="••••••••" 
                        {...field} 
                        className="bg-black/50 border-white/10 focus:border-primary/50 text-white h-12"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-heading tracking-widest text-lg transition-all"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Authenticating..." : "Initialize Session"}
              </Button>
            </form>
          </Form>
        </div>
      </motion.div>
    </div>
  );
}
