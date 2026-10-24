# Iron Grind Data Flow Diagram Explanation

Figure 4 shows the main flow of data in the Iron Grind system from the user interface to the database and back. It is designed to reflect the actual structure of the project: a browser-based front end, Supabase for authentication and database services, and a set of operational modules for membership registration, attendance, inventory, and sales.

## 1. User interaction flow

The system starts with the user using the website through the browser interface. Members and applicants interact with pages such as `index.html`, `register.html`, `customer.html`, and `admin.html`. The member or applicant enters login credentials, personal details, emergency contact information, and membership application data. The administrator or staff member uses the admin page to review applications and manage operations.

## 2. Login and authentication

The browser connects to Supabase Auth, which handles account creation, sign in, sign out, password reset, and session management. When a new user registers, Supabase Auth creates the account and the database trigger `handle_new_auth_user()` creates a matching `profiles` row. This profile stores the user’s email, username, full name, and role such as `member` or `admin`.

This means the user identity is verified by Supabase first, and then the system loads the role from `profiles` to decide whether the user should open the member dashboard or admin dashboard.

## 3. Registration and application processing

When an applicant submits a membership form, the data is inserted into `membership_applications` with a status of `pending`. This table stores the registration and renewal details, plan selection, health declarations, emergency contact information, and digital signature information.

The admin then reviews the application. If approved, the system creates or links the record in `members`. The member record contains the approved membership details such as plan, start date, expiry date, payment status, and contact information. If rejected, the application remains recorded but marked as rejected.

## 4. Member portal access

Once the member is approved, the member dashboard reads the member record and the related attendance and membership information. The member can view their personal details, membership status, remaining days, workout goals, and attendance history. Member updates, such as personal information changes, pass through Supabase functions and database procedures to update the correct row without exposing unwanted data.

## 5. Attendance, inventory, and sales modules

The system has separate operational modules for:

- Attendance: records check-in and check-out times in the `attendance` table.
- Inventory: manages products in the `products` table.
- Sales: records receipts and sale items in `sales` and `sale_items`.
- Membership history: tracks expired memberships, plan changes, and renewals in `membership_history`.

These modules are connected to the central database and are available to the admin through the operations dashboard. Members can also view active products and their own attendance history.

## 6. Central database and security boundary

The bottom of the diagram shows the central PostgreSQL database that stores all major entities:

- `profiles`
- `members`
- `membership_applications`
- `attendance`
- `products`
- `sales`
- `sale_items`
- `membership_history`

The data is protected by Row Level Security (RLS). This means users can only access records that are allowed by the policies, such as their own profile or their own attendance. Admin-only actions are protected by database rules and verified through Supabase Auth and Edge Functions.

## 7. Why the flow matters

This design separates the system into clear responsibilities:

- Frontend pages collect user input.
- Supabase Auth handles user identity and security.
- The database stores the actual business records.
- Admin pages review and approve applications.
- Operational modules process attendance, sales, and inventory.

This keeps the application structured, secure, and easier to maintain because each stage of the process has a specific function and a defined data source.

## Related implementation files

- [server.js](../server.js)
- [assets/js/auth.js](../assets/js/auth.js)
- [assets/js/register.js](../assets/js/register.js)
- [assets/js/customer.js](../assets/js/customer.js)
- [assets/js/admin.js](../assets/js/admin.js)
- [assets/js/supabase-client.js](../assets/js/supabase-client.js)
- [supabase/schema.sql](../supabase/schema.sql)

This diagram is consistent with the actual project logic used in the current system.
