"use client"

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/actions/profile.actions";
import { useTransition } from "react";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "O nome deve ter pelo menos 2 caracteres.",
	}),
});

interface ProfileFormProps {
	user: {
		id: string;
		name: string | null;
		email: string | null;
	};
	orgUniqueId: string;
}

export function ProfileForm({ user, orgUniqueId }: ProfileFormProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: user.name || "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		startTransition(async () => {
			try {
				const result = await updateProfile(orgUniqueId, values);

				if (result.success) {
					toast.success("Nome atualizado com sucesso!");
					router.refresh();
				} else {
					toast.error(result.error || "Erro ao atualizar nome");
				}
			} catch (error) {
				console.error("Erro ao atualizar nome:", error);
				toast.error("Erro ao atualizar nome");
			}
		});
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Nome</FormLabel>
							<FormControl>
								<Input 
									placeholder="Seu nome" 
									{...field} 
									disabled={isPending}
								/>
							</FormControl>
							<FormDescription>
								Este é o nome que será exibido para outros usuários.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="text-sm text-muted-foreground">
					<p>E-mail: {user.email}</p>
					<p className="text-xs mt-1">Para alterar seu e-mail, entre em contato com o suporte.</p>
				</div>

				<Button 
					type="submit" 
					disabled={isPending}
				>
					{isPending ? "Salvando..." : "Salvar alterações"}
				</Button>
			</form>
		</Form>
	);
} 