"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import {
  Github,
  Star,
  Code,
  Shield,
  Zap,
  Users,
  Heart,
  CheckCircle,
  Download,
  Rocket,
  Lock,
  CreditCard,
  Mail,
  Smartphone,
  DockIcon as Docker,
  Database,
  Palette,
  Globe,
} from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Logo } from "@/components/ui/logo"
import { StartButton } from "@/components/auth/start-button"

export default function LandingPage() {
  const features = [
    {
      icon: <Rocket className="h-6 w-6" />,
      title: "Next.js 15 com App Router",
      description: "Construído com o mais recente Next.js e App Router moderno para performance otimizada e SEO",
    },
    {
      icon: <Lock className="h-6 w-6" />,
      title: "Autenticação Completa",
      description: "Google OAuth + Magic Link de autenticação prontos para uso, sem custos adicionais",
    },
    {
      icon: <CreditCard className="h-6 w-6" />,
      title: "Integração Stripe",
      description: "Gerenciamento completo de assinaturas e pagamentos, pronto para monetização",
    },
    {
      icon: <Palette className="h-6 w-6" />,
      title: "UI Moderna com shadcn/ui",
      description: "Componentes bonitos, acessíveis e totalmente personalizáveis com Tailwind CSS",
    },
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: "Design Responsivo",
      description: "Otimizado para todos os dispositivos com abordagem mobile-first e PWA",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Segurança Reforçada",
      description: "Verificação de IP, proteção CSRF, rate limiting e boas práticas de segurança",
    },
    {
      icon: <Mail className="h-6 w-6" />,
      title: "Sistema de Email",
      description: "Sistema de email integrado com Resend para notificações e autenticação",
    },
    {
      icon: <Docker className="h-6 w-6" />,
      title: "Deploy Simplificado",
      description: "Ambientes de desenvolvimento e produção containerizados com Docker",
    },
  ]

  const technologies = [
    "Next.js 15",
    "TypeScript",
    "Tailwind CSS",
    "shadcn/ui",
    "Prisma",
    "PostgreSQL",
    "Stripe",
    "NextAuth.js",
    "Resend",
    "Docker",

    "PWA",
    "SEO Otimizado",
    "Analytics",
  ]

  const benefits = [
    "100% gratuito e código aberto",
    "Economize semanas de desenvolvimento",
    "Arquitetura pronta para produção",
    "Documentação detalhada e em português",
    "Suporte ativo da comunidade",
    "Atualizações e melhorias regulares",
    "Licença MIT - use em qualquer projeto",
    "Sem custos ocultos ou limitações",
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo size="md" />
            <Badge variant="secondary">Código Aberto</Badge>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="#recursos" className="text-sm font-medium hover:text-primary transition-colors">
              Recursos
            </Link>
            <Link href="#tecnologias" className="text-sm font-medium hover:text-primary transition-colors">
              Tecnologias
            </Link>
            <Link href="#comunidade" className="text-sm font-medium hover:text-primary transition-colors">
              Comunidade
            </Link>
          </nav>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="https://github.com/vinimatheus/starter-org-dog" className="flex items-center space-x-2">
                <Github className="h-4 w-4" />
                <span className="hidden sm:inline">GitHub</span>
              </Link>
            </Button>
            <StartButton variant="sm" className="px-4" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 relative overflow-hidden w-full">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <motion.div
              className="flex items-center justify-center space-x-2 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="px-3 py-1">
                <Star className="h-3 w-3 mr-1" />
                100% Gratuito
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Code className="h-3 w-3 mr-1" />
                Código Aberto
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Heart className="h-3 w-3 mr-1" />
                Licença MIT
              </Badge>
            </motion.div>

            <motion.h1
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Comece Seu SaaS
              <span className="block text-primary">Sem Custos Hoje</span>
            </motion.h1>

            <motion.p
              className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Um kit inicial completo e gratuito para construir seu SaaS com as melhores tecnologias do mercado.
              <span className="text-foreground font-medium">
                {" "}
                Código aberto, sem limitações e pronto para produção.
              </span>
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <StartButton />
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="https://github.com/vinimatheus/starter-org-dog" className="flex items-center space-x-2">
                  <Github className="h-5 w-5" />
                  <span>Ver no GitHub</span>
                </Link>
              </Button>
            </motion.div>

            <motion.div
              className="flex items-center justify-center space-x-8 pt-8 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Orientado pela Comunidade</span>
              </div>
              <div className="flex items-center space-x-2">
                <Heart className="h-4 w-4" />
                <span>Licença MIT</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span>Pronto para Produção</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="py-20 bg-muted/30 w-full">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="px-3 py-1">
              <Zap className="h-3 w-3 mr-1" />
              Recursos
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Tudo Que Você Precisa</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Um kit inicial abrangente com todos os recursos essenciais para aplicações SaaS modernas
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                  <CardHeader className="pb-4">
                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Source Benefits */}
      <section className="py-20 w-full">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Badge variant="outline" className="px-3 py-1">
                <Code className="h-3 w-3 mr-1" />
                Código Aberto
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold">Por Que Código Aberto Importa</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Nossa abordagem de código aberto garante transparência, colaboração da comunidade e personalização
                ilimitada. Você não está preso às nossas decisões – torne-o verdadeiramente seu.
              </p>

              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center space-x-3"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button asChild>
                  <Link href="https://github.com/vinimatheus/starter-org-dog" className="flex items-center space-x-2">
                    <Github className="h-4 w-4" />
                    <span>Explorar Código</span>
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="bg-card border rounded-lg p-6 shadow-sm">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-muted-foreground ml-2">terminal</span>
                </div>
                <div className="font-mono text-sm space-y-2">
                  <div className="text-green-400">$ git clone https://github.com/vinimatheus/starter-org-dog.git</div>
                  <div className="text-blue-400">$ cd starter-org-dog</div>
                  <div className="text-yellow-400">$ npm install</div>
                  <div className="text-purple-400">$ docker-compose up -d</div>
                  <div className="text-green-400">$ npm run dev</div>
                  <div className="text-muted-foreground">✨ Seu SaaS está pronto em http://localhost:3000</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Technologies Section */}
      <section id="tecnologias" className="py-20 bg-muted/30 w-full">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="px-3 py-1">
              <Database className="h-3 w-3 mr-1" />
              Stack Tecnológico
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Construído com Tecnologias Modernas</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tecnologias cuidadosamente selecionadas que funcionam perfeitamente juntas
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {technologies.map((tech, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                viewport={{ once: true }}
              >
                <Badge variant="secondary" className="px-4 py-2 text-sm flex items-center space-x-2">
                  <span>{tech}</span>
                </Badge>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="border-0 shadow-sm h-full">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <span>Frontend</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">React moderno com Next.js 15 e componentes de UI bonitos</p>
                  <div className="space-y-2">
                    <div className="text-sm flex items-center space-x-2">
                      <span>Next.js 15 com App Router</span>
                    </div>
                    <div className="text-sm flex items-center space-x-2">
                      <span>TypeScript para segurança de tipos</span>
                    </div>
                    <div className="text-sm flex items-center space-x-2">
                      <span>shadcn/ui + Tailwind CSS</span>
                    </div>
                    <div className="text-sm">• Design responsivo</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="border-0 shadow-sm h-full">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="h-5 w-5 text-primary" />
                    <span>Backend</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Backend robusto com autenticação e pagamentos</p>
                  <div className="space-y-2">
                    <div className="text-sm flex items-center space-x-2">
                      <span>Prisma ORM com PostgreSQL</span>
                    </div>
                    <div className="text-sm flex items-center space-x-2">
                      <span>Autenticação NextAuth.js</span>
                    </div>
                    <div className="text-sm flex items-center space-x-2">
                      <span>Integração de pagamento Stripe</span>
                    </div>
                    <div className="text-sm">• Rotas de API e webhooks</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <Card className="border-0 shadow-sm h-full">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Docker className="h-5 w-5 text-primary" />
                    <span>DevOps</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Deploy pronto para produção e ferramentas de desenvolvimento
                  </p>
                  <div className="space-y-2">
                    <div className="text-sm flex items-center space-x-2">
                      <span>Containerização Docker</span>
                    </div>
                    <div className="text-sm">• Configuração de ambiente</div>
                    <div className="text-sm">• Melhores práticas de segurança</div>
                    <div className="text-sm flex items-center space-x-2">
                      <span>Sistema de email com Resend</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section id="comecar" className="py-20 w-full">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="px-3 py-1">
              <Rocket className="h-3 w-3 mr-1" />
              Começar
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Comece a Construir em Minutos</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Siga nosso guia abrangente para colocar seu SaaS em funcionamento
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                icon: <Download className="h-6 w-6" />,
                title: "1. Clonar e Instalar",
                description: "Clone o repositório e instale as dependências com um único comando",
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: "2. Configurar",
                description: "Configure suas variáveis de ambiente e integrações",
              },
              {
                icon: <Zap className="h-6 w-6" />,
                title: "3. Lançar",
                description: "Inicie o servidor de desenvolvimento e comece a personalizar seu SaaS",
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="border-0 shadow-sm text-center h-full">
                  <CardHeader>
                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mx-auto mb-4">
                      {step.icon}
                    </div>
                    <CardTitle>{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <StartButton />
              <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
                <Link href="https://github.com/vinimatheus/starter-org-dog" className="flex items-center space-x-2">
                  <Github className="h-5 w-5" />
                  <span>Ver no GitHub</span>
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Community Section */}
      <section id="comunidade" className="py-20 w-full">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="px-3 py-1">
              <Users className="h-3 w-3 mr-1" />
              Comunidade
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold">Junte-se à Nossa Comunidade</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Conecte-se com outros desenvolvedores, contribua para o projeto e obtenha suporte
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Github className="h-12 w-12 text-primary mx-auto mb-4" />,
                title: "Contribuir",
                description: "Ajude a melhorar o projeto contribuindo com código, relatando bugs ou sugerindo recursos",
                button: "Ver no GitHub",
                link: "https://github.com/vinimatheus/starter-org-dog",
              },
              {
                icon: <Code className="h-12 w-12 text-primary mx-auto mb-4" />,
                title: "Código Aberto",
                description: "Explore o código fonte, faça fork e adapte para suas necessidades",
                button: "Explorar Código",
                link: "https://github.com/vinimatheus/starter-org-dog",
              },
              {
                icon: <Heart className="h-12 w-12 text-primary mx-auto mb-4" />,
                title: "Suporte",
                description: "Obtenha ajuda da comunidade e mantenedores através de issues e discussões no GitHub",
                button: "Obter Suporte",
                link: "https://github.com/vinimatheus/starter-org-dog/issues",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="border-0 shadow-sm text-center h-full">
                  <CardHeader>
                    {item.icon}
                    <CardTitle>{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col justify-between h-full">
                    <p className="text-muted-foreground mb-4">{item.description}</p>
                    <Button variant="outline" asChild>
                      <Link href={item.link}>{item.button}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12 w-full">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <Logo size="md" />
              <p className="text-sm text-muted-foreground">
                Um kit inicial moderno e de código aberto para SaaS construído com as melhores tecnologias.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Produto</h4>
              <div className="space-y-2 text-sm">
                <Link href="#recursos" className="block text-muted-foreground hover:text-foreground">
                  Recursos
                </Link>
                <Link href="#tecnologias" className="block text-muted-foreground hover:text-foreground">
                  Tecnologias
                </Link>
                <Link href="#comecar" className="block text-muted-foreground hover:text-foreground">
                  Começar
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Recursos</h4>
              <div className="space-y-2 text-sm">
                <Link
                  href="https://github.com/vinimatheus/starter-org-dog"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  GitHub
                </Link>
                <Link href="#comunidade" className="block text-muted-foreground hover:text-foreground">
                  Comunidade
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Legal</h4>
              <div className="space-y-2 text-sm">
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Licença MIT
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Política de Privacidade
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Termos de Serviço
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Dog SaaS. Construído com ❤️ por{" "}
              <Link href="https://github.com/vinimatheus" className="text-foreground hover:underline">
                Vinicius Matheus
              </Link>
            </p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <Button variant="ghost" size="sm" asChild>
                <Link href="https://github.com/vinimatheus/starter-org-dog">
                  <Github className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="https://github.com/vinimatheus/starter-org-dog">
                  <Star className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
