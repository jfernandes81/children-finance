# Poupadinha

App web mobile-first para as filhas controlarem o que recebem e gastam, e para os pais verem saldos e movimentos.

## Stack

- **Frontend:** React + Vite + TypeScript (Nginx em produção)
- **Backend:** Node (Express) + SQLite
- **Auth:** utilizador + palavra-passe (JWT)

## Correr com Docker (recomendado)

Na raiz do projeto:

```bash
docker compose up --build -d
```

Abre: [http://localhost:8080](http://localhost:8080)

Para parar:

```bash
docker compose down
```

Os dados da SQLite ficam no volume Docker `poupadinha-data`.

Variáveis opcionais (ficheiro `.env` na raiz):

```env
APP_PORT=8080
JWT_SECRET=uma-chave-secreta-tua
```

## Desenvolvimento local (sem Docker)

### 1. Backend

```bash
cd backend
npm install
npm run seed
npm start       # http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

O Vite faz proxy de `/api` para o backend.

## Contas de exemplo (seed)

| Utilizador | Palavra-passe | Papel  |
|------------|---------------|--------|
| `pais`     | CasaPais      | Pais   |
| `eva`      | Unicornio     | Filha  |
| `beatriz`  | Borboleta     | Filha  |

## Funcionalidades

**Filha:** adicionar receitas/despesas, ver saldo e histórico; alterar a própria palavra-passe.

**Pais:** ver saldos, editar ou apagar movimentos, filtrar histórico; alterar a própria palavra-passe.

## Estrutura

```
children-finance/
  backend/           # API Express + SQLite
  frontend/          # App React
  docker-compose.yml
```

## Notas

- Em desenvolvimento local a BD fica em `backend/data/finance.db`.
- Para voltar a fazer seed do zero em local, apaga `backend/data/finance.db` (e ficheiros `.db-*`) e corre `npm run seed`.
- Em Docker: `docker compose down -v` apaga o volume e os dados.
- Altera as palavras-passe no seed (`backend/src/seed.ts`) antes de usar em casa a sério.
