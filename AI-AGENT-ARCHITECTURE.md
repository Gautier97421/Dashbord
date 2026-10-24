# AI Agent System Architecture (V1)

## 🎯 Core Principles

1. **AI Never Acts Directly**: AI only suggests → User confirms → Backend executes
2. **Secure Backend Only**: All sensitive operations (API calls, token management) happen server-side
3. **Clear Tool System**: Extensible, modular tool definitions
4. **Audit Trail**: Every action is logged for security & debugging

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│  • User requests AI analysis                                │
│  • Displays AI suggestions                                  │
│  • Confirms/rejects actions                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Next.js API Routes)                    │
│                                                              │
│  1. Orchestrator Controller                                 │
│     • Receives user request                                 │
│     • Calls AI engine → returns suggestion                  │
│     • Validates AI output                                   │
│     • Sends to frontend for confirmation                    │
│                                                              │
│  2. AI Engine                                               │
│     • Receives: user request + available tools             │
│     • Returns: tool_name + params as JSON                  │
│     • (Mock or real LLM - e.g., OpenAI)                    │
│                                                              │
│  3. Tool System                                             │
│     • gmail.readEmails(filter, count)                      │
│     • gmail.labelEmails(emailIds, label)                   │
│     • gmail.moveEmails(emailIds, folder)                   │
│     • Each tool validates inputs, calls Gmail API          │
│                                                              │
│  4. Gmail API Integration                                   │
│     • Manages OAuth tokens (encrypted)                      │
│     • Refresh token handling                                │
│     • API error handling                                    │
│                                                              │
│  5. Action Executor                                         │
│     • Receives confirmed action                             │
│     • Executes the tool                                     │
│     • Logs result to database                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         EXTERNAL SERVICES & DATABASE                         │
│  • Gmail API (googleapis.com)                               │
│  • PostgreSQL (encrypted tokens, action logs)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Folder Structure

```
lib/
├── ai-agent/
│   ├── engine.ts              # Core AI orchestration
│   ├── tool-registry.ts       # Register & validate tools
│   └── types.ts               # AI types (ToolCall, AIResponse, etc)
│
├── tools/
│   ├── gmail.ts               # Gmail tools (read, label, move)
│   ├── tool-executor.ts       # Execute any registered tool
│   └── base.ts                # Tool base class & interfaces
│
├── gmail/
│   ├── oauth.ts               # OAuth2 flow
│   ├── client.ts              # Gmail API client
│   └── types.ts               # Gmail types
│
├── security/
│   ├── encryption.ts          # AES-256 token encryption
│   └── types.ts               # Security types
│
├── db/
│   └── actions.ts             # Database action logging
│
└── types.ts                   # Global types

app/api/
├── ai/
│   ├── analyze/route.ts       # POST - AI suggests action
│   ├── confirm/route.ts       # POST - User confirms
│   └── history/route.ts       # GET - Action history
│
└── gmail/
    ├── auth/route.ts          # POST - OAuth callback
    └── emails/route.ts        # GET - Fetch emails for analysis

components/
└── ai-agent/
    ├── email-analyzer.tsx     # Main component
    ├── action-dialog.tsx      # Action confirmation dialog
    └── action-history.tsx     # View past actions
```

---

## 🔄 Request Flow

### 1️⃣ User Requests Analysis

```
Frontend: "Organize my important emails"
    ↓
POST /api/ai/analyze
  {
    "request": "Organize my important emails",
    "context": "gmail"
  }
    ↓
Backend Orchestrator:
  1. Fetch user's Gmail access token
  2. Call AI Engine with:
     - User request
     - Available tools list
  3. AI returns: { tool: "gmail.labelEmails", params: {...} }
    ↓
Validate AI output (tool exists, params valid)
    ↓
Response to Frontend:
  {
    "suggestion": {
      "tool": "gmail.labelEmails",
      "humanReadable": "Label emails from important senders as 'Important'",
      "params": {...}
    },
    "requiresConfirmation": true
  }
```

### 2️⃣ User Confirms Action

```
Frontend: User clicks "Confirm"
    ↓
POST /api/ai/confirm
  {
    "suggestionId": "sug_123",
    "approved": true
  }
    ↓
Backend:
  1. Fetch suggestion from DB
  2. Call Tool Executor with the tool & params
  3. Execute on Gmail API
  4. Log action to actions_log table
    ↓
Response:
  {
    "success": true,
    "result": {
      "emailsModified": 5,
      "details": "5 emails labeled as 'Important'"
    }
  }
    ↓
Frontend: Show success toast + result
```

---

## 🗄️ Database Schema

### New Tables

```sql
-- OAuth Accounts (Gmail credentials)
table oauth_accounts {
  id              String @unique
  userId          String
  provider        String ("gmail")
  providerUserId  String
  accessToken     String (encrypted)
  refreshToken    String (encrypted)
  expiresAt       DateTime?
  createdAt       DateTime
  updatedAt       DateTime
}

-- AI Suggestions (before execution)
table ai_suggestions {
  id              String @unique
  userId          String
  requestText     String
  tool            String
  params          Json
  status          String ("pending" | "approved" | "rejected" | "executed")
  result          Json?
  createdAt       DateTime
  confirmedAt     DateTime?
  executedAt      DateTime?
}

-- Action Logs (audit trail)
table action_logs {
  id              String @unique
  userId          String
  actionType      String ("gmail.labelEmails" | "gmail.moveEmails", ...)
  status          String ("success" | "failed")
  input           Json
  output          Json
  errorMessage    String?
  createdAt       DateTime
}
```

---

## 🔐 Security Model

1. **Token Storage**
   - Access tokens & refresh tokens encrypted with AES-256
   - Key stored in `ENCRYPTION_KEY` env var
   - Never exposed to frontend

2. **API Access Control**
   - All routes require `getServerSession()` check
   - Actions logged with timestamp & user ID
   - Tool execution validated before Gmail API call

3. **Rate Limiting** (Recommended for V2)
   - Limit AI analysis requests per user/hour
   - Limit Gmail API calls per user/day

---

## 🧰 Tool System (Extensible)

### Define Tools Once

```typescript
const gmailTools = {
  readEmails: {
    description: "Read emails matching a filter",
    params: {
      filter: "string (important, from:sender@example.com, etc)",
      maxResults: "number (1-100)",
    },
    execute: async (params, gmail_client) => {
      // Actual Gmail API call
    }
  },

  labelEmails: {
    description: "Label emails with a label",
    params: {
      query: "string (Gmail search query)",
      label: "string (label name)",
    },
    execute: async (params, gmail_client) => {
      // Actual Gmail API call
    }
  }
}
```

### AI Receives Tool List

```json
{
  "availableTools": [
    {
      "name": "gmail.readEmails",
      "description": "Read emails matching a filter"
    },
    {
      "name": "gmail.labelEmails",
      "description": "Label emails with a label"
    }
  ],
  "userRequest": "Organize my emails",
  "context": "User has 500 unread emails"
}
```

### AI Returns Tool Call

```json
{
  "tool": "gmail.labelEmails",
  "params": {
    "query": "is:unread from:boss@company.com",
    "label": "Urgent"
  }
}
```

---

## 📦 Dependencies to Add

```bash
npm install googleapis crypto-js dotenv
```

- `googleapis`: Official Gmail API client
- `crypto-js`: AES encryption (can also use `crypto` built-in)
- `dotenv`: Environment variables

---

## ⚙️ Environment Variables

```env
# Gmail OAuth
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/auth/callback

# Encryption
ENCRYPTION_KEY=<32-byte hex string for AES-256>

# AI (if using real LLM)
OPENAI_API_KEY=...
```

---

## 🚀 Implementation Phases

### Phase 1: Core Infrastructure (Current)
- ✅ Database schema extensions
- ✅ Security utilities (encryption)
- ✅ Tool system framework
- ✅ OAuth integration
- ✅ Mock AI engine

### Phase 2: Real AI Integration (Optional)
- OpenAI API integration
- Function calling support
- Prompt engineering

### Phase 3: Advanced Features (V2+)
- Multiple AI providers
- Complex multi-step workflows
- Rate limiting & quotas
- Advanced audit logging
- Tool result caching

---

## 🎯 Key Design Decisions

1. **Backend-First**: Never expose tokens or sensitive data to frontend
2. **Confirmation Required**: All AI suggestions require user approval
3. **Modular Tools**: Each action is a reusable, testable tool
4. **Audit Trail**: Every action logged for compliance & debugging
5. **Error Handling**: Graceful failures with user-friendly messages
6. **Extensibility**: Easy to add new tools & AI providers

---

## ✅ Security Checklist

- [ ] All OAuth tokens encrypted in database
- [ ] Session validation on every API call
- [ ] Tool execution validated before Gmail API call
- [ ] Action logging captures all sensitive data (separately)
- [ ] Error messages don't leak sensitive info
- [ ] Rate limiting on AI analysis requests
- [ ] CSRF protection on confirmation endpoint
- [ ] Input validation on all tool params

---

## 📚 Next Steps

1. Add Prisma schema extensions
2. Create security utilities
3. Implement Gmail OAuth
4. Build tool system
5. Create API routes
6. Build React components
7. Wire it all together
