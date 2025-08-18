# Finance AI - WebApp de Gestão Financeira Multi-Regional com IA

Uma aplicação web completa de gestão financeira pessoal com inteligência artificial, desenvolvida com Next.js 15, React 19, TypeScript e Supabase.

## 🚀 Características Principais

### 📊 Dashboard Interativo
- Visão geral do património financeiro
- Gráficos interativos de evolução do património líquido
- Análise de gastos por categoria
- Transações recentes

### 💰 Gestão de Transações
- Adicionar/editar/eliminar transações
- Categorização automática (receitas/despesas)
- Suporte multi-moeda (EUR/BRL)
- Filtros avançados e pesquisa

### 🔄 Custos Fixos
- Gestão de despesas recorrentes
- Períodos configuráveis (semanal, mensal, anual)
- Cálculo automático de próximas cobranças
- Estimativa de impacto mensal

### 🎯 Objetivos Financeiros
- Definição de metas financeiras
- Acompanhamento de progresso em tempo real
- Datas-alvo e notificações
- Visualização de percentagem de conclusão

### 🏦 Gestão de Contas
- Múltiplas contas bancárias
- Diferentes tipos (corrente, poupança, crédito, investimento)
- Saldos em tempo real
- Ativação/desativação de contas

### 🔐 Autenticação e Segurança
- Sistema de login/registo seguro
- Autenticação via Supabase
- Row Level Security (RLS)
- Proteção de rotas

### 🌍 Multi-Regional
- Suporte a EUR e BRL
- Interface em português
- Formatação de moeda por região
- Configurações personalizáveis

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 15.4.6, React 19.1.1, TypeScript
- **Styling**: Tailwind CSS
- **Base de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Gráficos**: Chart.js + react-chartjs-2
- **Ícones**: Lucide React
- **Deploy**: Vercel (recomendado)

## 📦 Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/your-username/finance_AI.git
cd finance_AI
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```

Edite `.env.local` com as suas credenciais do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. **Configure a base de dados**

Execute as migrações no Supabase SQL Editor:
```sql
-- Copie e execute o conteúdo de supabase/migrations/001_initial_setup.sql
```

5. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

## 🗄️ Estrutura da Base de Dados

### Tabelas Principais

- **users**: Perfis de utilizador (extensão do auth.users)
- **accounts**: Contas bancárias do utilizador
- **categories**: Categorias de transações
- **transactions**: Registos de receitas e despesas
- **fixed_costs**: Custos recorrentes
- **goals**: Objetivos financeiros
- **budgets**: Orçamentos por categoria

### Funcionalidades de Segurança

- Row Level Security (RLS) em todas as tabelas
- Políticas de acesso baseadas no utilizador autenticado
- Triggers automáticos para auditoria

## 🎨 Funcionalidades da Interface

### Dashboard
- Cards de resumo (património, receitas, despesas)
- Gráfico de linha para evolução temporal
- Gráfico circular para distribuição de gastos
- Lista de transações recentes

### Transações
- Formulário completo com validação
- Filtros por tipo, categoria, conta e data
- Pesquisa em tempo real
- Operações CRUD completas

### Custos Fixos
- Formulário de criação com períodos flexíveis
- Cálculo automático de próximas cobranças
- Estimativa de impacto mensal total
- Ativação/desativação individual

### Objetivos
- Definição de metas com valores-alvo
- Atualização de progresso em tempo real
- Barras de progresso visuais
- Indicadores de prazo

### Configurações
- Gestão de contas bancárias
- Preferências de moeda e idioma
- Configurações de notificação
- Perfil de utilizador

## 🚀 Deploy

### Vercel (Recomendado)
1. Conecte o repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático

### Manual
```bash
npm run build
npm start
```

## 🔧 Scripts Disponíveis

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build de produção
- `npm run start` - Servidor de produção
- `npm run lint` - Verificação de código

## 📱 Responsividade

A aplicação é totalmente responsiva e otimizada para:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para a sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit as suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para questões e suporte:
- Abra uma issue no GitHub
- Email: your-email@example.com

## 🎯 Roadmap

- [ ] Integração com IA para insights financeiros
- [ ] Importação de extratos bancários
- [ ] Relatórios avançados em PDF
- [ ] Notificações push
- [ ] App mobile React Native
- [ ] Integração com Open Banking
- [ ] Análise preditiva de gastos
- [ ] Recomendações de investimento

---

Desenvolvido com ❤️ para ajudar na gestão financeira pessoal.
