is i# Iron Grind System Architecture Diagram Explanation

Figure 3 presents the main components of the Iron Grind Fitness Gym Membership and Operations Management System and shows how user requests pass through the website and Supabase services to the shared PostgreSQL database. The diagram follows the current project structure: the browser runs the front-end pages, Supabase provides authentication and data services, and PostgreSQL stores the system records.

## 1. Users and website pages

Applicants and members use the login, registration, and member pages. Administrators and staff use the admin dashboard. These pages collect input and display records returned by Supabase; the browser is the client that sends requests to the backend services.

## 2. Authentication and role routing

On sign-in, the login page sends the supplied email and password to Supabase Auth. Auth verifies the credentials and returns either an authenticated session or an error. After successful authentication, the application reads the user's `profiles` row to determine the account role. An administrator is routed to `admin.html`; a member account is matched to its membership record and routed to the member experience. The role controls which parts of the application are available, while database policies and server-side checks protect the underlying data.

## 3. Registration and membership applications

Online registration creates an account through Supabase Auth. A database trigger creates the corresponding profile, and the registration flow stores the application in `membership_applications` with a pending status. Staff review applications from the admin dashboard. Approval creates or updates a member record, records the membership payment through the registration-sale RPC, and updates the application status. Rejected applications remain recorded with their review status.

Staff-created accounts use the `admin-create-member` Edge Function. It verifies the administrator before using privileged server-side operations to create the Auth account and record the member and related sale data.

## 4. Operational modules

The admin dashboard groups the main gym workflows into services:

- **Applications and membership:** submits and reviews applications, manages member records, and records membership sales.
- **Attendance and QR:** resolves the member and records check-in or check-out activity in `attendance`.
- **Inventory and products:** manages product details and stock in `products`; members can view the active catalog.
- **Walk-in POS and receipts:** calls `record_walk_in_sale()` to validate a sale, save its receipt and line items in `sales` and `sale_items`, and update stock for merchandise.
- **Member portal:** reads the member's own membership and attendance information, displays active products, accepts renewal requests, and handles personal-information updates.
- **Reports and exports:** reads and filters membership, attendance, inventory, sales, and membership-history data for dashboard summaries and reports.

Each module sends the relevant database requests and receives query results or operation responses back in the browser.

## 5. Supabase services and database security

Direct browser table requests pass through the Supabase Data API with the signed-in user's Auth session. PostgreSQL Row Level Security (RLS) policies restrict which rows the user can access. Database RPC functions also perform their own authorization and validation checks. Privileged account creation is routed through the Edge Function, which verifies the admin role before it uses server credentials.

Supabase Realtime broadcasts changes for `membership_applications` and `attendance`, the tables included in the current `supabase_realtime` publication migration. The `members` table is not enabled in that publication, so member-table changes are not shown as an active Realtime flow in the diagram.

## 6. PostgreSQL data stores

Supabase PostgreSQL is the shared store for the system's main records:

- `profiles` — account profile and role associated with a Supabase Auth user.
- `members` — approved membership and member details.
- `membership_applications` — online registration and renewal submissions and their review status.
- `attendance` — member check-in and check-out records.
- `products` — product catalog and inventory details.
- `sales` and `sale_items` — receipts and their itemized lines.
- `membership_history` — membership expiry, renewal, and plan-change history.

Supabase Auth separately manages account identities and sessions; the architecture's PostgreSQL cylinder represents the application's shared business-data tables.

## 7. End-to-end request and response flow

The typical flow is: a user interacts with a page, the page sends an authenticated request to the appropriate Supabase service, the service or database checks access and validates the operation, PostgreSQL reads or saves the records, and Supabase returns the result to the page. For subscribed Realtime tables, database changes can also trigger updates in the relevant browser views.

## Related implementation files

- [index.html](../index.html)
- [register.html](../register.html)
- [admin.html](../admin.html)
- [assets/js/auth.js](../assets/js/auth.js)
- [assets/js/register.js](../assets/js/register.js)
- [assets/js/customer.js](../assets/js/customer.js)
- [assets/js/admin.js](../assets/js/admin.js)
- [assets/js/supabase-client.js](../assets/js/supabase-client.js)
- [supabase/migrations/realtime_live_updates.sql](../supabase/migrations/realtime_live_updates.sql)
- [supabase/migrations/admin_membership_operations.sql](../supabase/migrations/admin_membership_operations.sql)
- [supabase/functions/admin-create-member/index.ts](../supabase/functions/admin-create-member/index.ts)