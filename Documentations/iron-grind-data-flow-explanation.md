# Figure 4. Data Flow Diagram: Explanation

The diagram shows how applicants, members, and gym staff exchange data with the Iron Grind web application and its Supabase services. The website is a browser-based client. The Node.js server delivers static page files; it does not process membership or operational records.

## Process Descriptions

1. **Account and session (1.0):** Supabase Auth validates sign-in credentials and handles account creation, email confirmation, sign-out, and password recovery. When a user signs up, a database trigger creates the corresponding `profiles` row.
2. **Registration and renewal (2.0):** Applicants submit registration data, health declarations, plan information, and a signature. Members submit renewal requests. These submissions are stored as pending records in `membership_applications` for staff review.
3. **Member portal (3.0):** Members retrieve their linked membership, attendance history, and active product catalog. Personal-information changes use a database RPC, and renewal requests are written to `membership_applications`.
4. **Admin membership management (4.0):** Staff review applications and manage member records, membership changes, and history. Approvals can create or update member data and record membership sales.
5. **Attendance, inventory, and sales (5.0):** Staff use QR/member lookup for check-in and check-out, maintain products and stock, and record sales and receipt line items. Some related writes are performed by database RPCs.
6. **Reports and dashboard (6.0):** The admin interface reads authorized membership, attendance, inventory, sales, and history data and presents totals and operational reports.
7. **Edge Functions (7.0):** Privileged admin member creation and store-password verification run on the server side. The functions verify the caller's Supabase identity and admin role; privileged credentials are not sent to the browser.

## Data Stores

- `auth.users` stores Supabase account identities and authentication data.
- `profiles` stores each user's application role and basic account profile.
- `membership_applications` stores registration and renewal submissions and their review status.
- `members` stores active member and membership details after approval or staff registration.
- `attendance` stores check-in and check-out events.
- `products` stores the catalog and inventory status.
- `sales` and `sale_items` store receipts and their itemized lines.
- `membership_history` stores expiry, renewal, and plan-change history.

## Access and Live Updates

Normal browser-to-database requests carry the user's Supabase session and are filtered by PostgreSQL Row Level Security (RLS). Members can access records associated with their own account, while administrative operations require the admin role. Supabase Realtime sends application, attendance, and member-name changes back to subscribed browser views.

An email confirmation or password recovery link is delivered through Supabase Auth's configured email service. When email confirmation delays an application insert, the registration page keeps a short-lived, password-free recovery draft in that browser.