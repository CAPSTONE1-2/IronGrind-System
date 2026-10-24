# Chapter-Style Data Flow Diagram Explanation

This version of the diagram uses labels that are more aligned with the wording usually used in a thesis or chapter discussion. The purpose is to show the actual flow of information inside the Iron Grind system in a clearer and more formal manner.

## 1. Member Login and Admin Login

The process begins when the user accesses the system through the web interface. The user enters their email and password in the login page. The browser sends the request to Supabase Auth for verification. If the credentials are valid, Supabase creates a user session and the system checks the user’s role from the `profiles` table.

If the role is `member`, the user is directed to the member dashboard. If the role is `admin`, the user is directed to the admin dashboard. This part of the process ensures that the system correctly separates member access from administrative access.

## 2. Membership Registration

The registration page collects personal data such as full name, date of birth, sex, mobile number, height, weight, emergency contact, chosen membership plan, and signature. This information is then submitted to Supabase Auth for user account creation and to the `membership_applications` table for review.

The registration data remains in a pending state until the administrator checks it. This is important because the system follows a controlled approval process before a person becomes an officially approved member.

## 3. Membership Application Review and Approval

The administrator reviews the submitted application from the admin dashboard. The application contains all required details needed to determine whether the applicant qualifies for membership. The admin then either approves or rejects the application.

If the application is approved, the member record is created and the details are stored in the `members` table. The application status changes from `pending` to `approved` and the member can now access their membership area.

## 4. Attendance Monitoring

Once the member is approved, the attendance system records the member’s check-in and check-out information. The `attendance` table stores the record of when a member enters and exits the gym. This function is important for monitoring membership usage and operational activity.

## 5. Inventory Management, Sales, and Reports

The system also includes inventory and sales operations. Product data such as name, price, stock, and category are stored in the `products` table. Sales transactions are recorded in `sales`, while the actual sale items are stored in `sale_items`.

The admin dashboard can generate reports based on attendance, inventory, sales, and membership records. This allows the staff to monitor gym operations and identify low stock, active members, and sales performance.

## 6. Central Database and Security

The central PostgreSQL database stores all major records, including profiles, members, applications, attendance, products, sales, and membership history. These tables are protected by Row Level Security (RLS), which ensures that users only access the records they are permitted to see.

This design keeps the system secure because the browser does not directly control the database. Instead, the database enforces access restrictions and the application logic calls the proper Supabase authentication and data services.

## Conclusion

The data flow shows that the system is organized around four main functions: user authentication, membership approval, operational tracking, and data management. The flow from member registration to admin approval to attendance, sales, and reporting demonstrates how each module is connected to the central database and how the system maintains both security and business processing.

This chapter-style description is intended to match formal documentation language and provide a clearer academic explanation of the system flow.
