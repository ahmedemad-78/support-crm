# Company Outlook notifications (Microsoft 365 / Exchange Online)

The application includes Microsoft Graph app-only sending. It needs the company's existing Exchange Online mailbox and an IT-admin-approved app. No Resend account, paid email integration, or new Azure paid resource is needed for this standard sendMail path within existing Microsoft 365 license and service limits. If the company's Outlook client connects to an on-premises or other mail provider, IT must confirm that provider's sending method instead.

## IT administrator setup

1. Choose an existing, approved sender mailbox (it may be Ahmed's mailbox). The current rollout recipient remains **ahmed.emad@selaheltelmeez.com**, independently of the sender.
2. In Microsoft Entra admin center → App registrations → New registration, create a single-tenant app named **Support CRM Notifications**. Use app-only client credentials; no interactive redirect URL is used by this implementation. Record the Directory (tenant) ID and Application (client) ID.
3. Create a client credential in Certificates & secrets and place its value directly in the Vercel project's server-side sensitive environment variables. Do not paste it in chat, GitHub, source files, or browser-visible NEXT_PUBLIC variables. Schedule rotation before expiry. Creating/granting the company app's access must be performed by its authorized IT administrator.
4. Prefer **Exchange Online Application RBAC**, scoped to the chosen sender mailbox only, with the **Application Mail.Send** role. IT creates the Exchange service-principal pointer and resource scope, assigns the role, and tests authorization. Do not grant mailbox read permissions. Do not add a separate tenant-wide Entra Mail.Send grant alongside the scoped RBAC grant: permissions are additive and that would defeat the mailbox restriction.

Example PowerShell for the Exchange administrator, after connecting to Exchange Online, with actual IDs substituted by IT:

```powershell
New-ServicePrincipal -AppId '<Application client ID>' -ObjectId '<Enterprise application service principal Object ID>' -DisplayName 'Support CRM Notifications'
New-ManagementScope -Name 'Support CRM Sender' -RecipientRestrictionFilter "PrimarySmtpAddress -eq '<approved-sender@company.com>'"
New-ManagementRoleAssignment -Name 'Support CRM Send Only' -App '<service principal Object ID>' -Role 'Application Mail.Send' -CustomResourceScope 'Support CRM Sender'
Test-ServicePrincipalAuthorization -Identity '<service principal Object ID>' -Resource '<approved-sender@company.com>'
```

The Object ID is from **Enterprise applications**, not the App registrations object's ID. IT should also test an unrelated mailbox and confirm it is outside the scope.

## Vercel configuration

Project **support-crm** → Settings → Environment Variables → **Production**:

| Variable | Value / purpose |
| --- | --- |
| GRAPH_TENANT_ID | Company Directory (tenant) ID |
| GRAPH_CLIENT_ID | Registered Application (client) ID |
| GRAPH_CLIENT_SECRET | Credential value, stored as Sensitive |
| GRAPH_SENDER | Approved sender mailbox address |
| CRON_SECRET | A new long random server secret for the existing retry endpoint, stored as Sensitive |
| NEXT_PUBLIC_APP_URL | https://support-crm-emad25.vercel.app |

Redeploy after setting the variables. The code prioritizes Microsoft Graph when all four GRAPH variables are present. SMTP username/password is not required for this route. No app access has been registered or granted automatically.

## Verification

1. Send one explicitly marked test notification to Ahmed after IT completes configuration.
2. Check Outlook Inbox / Junk and the sender's Sent Items. Graph `202 Accepted` means Microsoft accepted the request; it does not prove inbox delivery.
3. Confirm ticket number, source, problem, resolution/cause/action/outcome and the case link.
4. Confirm no recipient or CC is added for Kabany, Sonia, Olaa or Yasser. The central-only routing and legacy-job exclusions are enforced in the app and database.
5. New events attempt immediate delivery. The existing Vercel cron retries pending eligible jobs daily; CRON_SECRET must match Vercel's authorization header. The old pre-rollout jobs remain excluded.

References:
- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/auth-v2-service
- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac
- https://learn.microsoft.com/en-us/graph/metered-api-overview
