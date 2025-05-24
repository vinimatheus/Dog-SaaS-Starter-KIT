"use client"

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";

const formSchema = z.object({
	name: z.string().min(2, {
		message: "O nome deve ter pelo menos 2 caracteres.",
	}),
	email: z.string().email({
		message: "Digite um e-mail válido.",
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

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: user.name || "",
			email: user.email || "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		try {
			const response = await fetch(`/api/organizations/${orgUniqueId}/profile`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(values),
			});

			if (!response.ok) {
				throw new Error("Erro ao atualizar perfil");
			}

			toast.success("Perfil atualizado com sucesso!");
			router.refresh();
		} catch (error) {
      console.log(error)
			toast.error("Erro ao atualizar perfil");
		}
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
								<Input placeholder="Seu nome" {...field} />
							</FormControl>
							<FormDescription>
								Este é o nome que será exibido para outros usuários.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>E-mail</FormLabel>
							<FormControl>
								<Input placeholder="seu@email.com" {...field} />
							</FormControl>
							<FormDescription>
								Este é o e-mail que você usa para fazer login.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit">Salvar alterações</Button>
			</form>
		</Form>
	);
} 