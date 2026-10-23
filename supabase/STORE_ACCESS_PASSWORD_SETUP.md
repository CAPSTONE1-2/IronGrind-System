# Store access password

The Store password is read only by the `verify-store-password` Edge Function. It is not stored in browser code, local storage, or the database.

1. In the Supabase Dashboard, open the project and go to **Edge Functions → Secrets**.
2. Add a secret named `STORE_ACCESS_PASSWORD` and set its value to the Store password known only to the administrator.
3. Deploy the function from the project root:

   ```powershell
   npx.cmd supabase functions deploy verify-store-password --project-ref nttsrdassmzvtaamyogi
   ```

To change the password, update the `STORE_ACCESS_PASSWORD` secret in the Supabase Dashboard. The deployed function reads the current secret at runtime; redeploy only if Supabase indicates that the function needs it.

The function also validates the caller's Supabase session and `profiles.role = 'admin'` before checking the password. The browser receives only the authorization result.
